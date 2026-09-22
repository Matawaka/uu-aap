package witness

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

type uuCase struct {
	Semantic string `json:"semantic"`
	RawError string `json:"raw_error,omitempty"`
}

type uuResult struct {
	Schema string            `json:"schema"`
	Cases  map[string]uuCase `json:"cases"`
}

func uuSemantic(err error) string {
	switch {
	case err == nil:
		return "ACCEPT"
	case errors.Is(err, ErrOldSizeInvalid), errors.Is(err, ErrCheckpointStale):
		return "REJECT_ROLLBACK"
	case errors.Is(err, ErrRootMismatch):
		return "REJECT_CONFLICT_SAME_SIZE"
	case errors.Is(err, ErrNoValidSignature):
		return "REJECT_INVALID_SIGNATURE"
	case errors.Is(err, ErrInvalidProof):
		return "REJECT_INCONSISTENT_EXTENSION"
	default:
		return "REJECT_OTHER"
	}
}

func TestUUAAPDifferentialQualification(t *testing.T) {
	outPath := os.Getenv("UU_AAP_OUT")
	fixtures := os.Getenv("UU_AAP_FIXTURES")
	if outPath == "" || fixtures == "" {
		t.Fatal("UU_AAP_OUT and UU_AAP_FIXTURES are required")
	}
	if err := os.MkdirAll(fixtures, 0o755); err != nil {
		t.Fatal(err)
	}

	forkRoot := make([]byte, 32)
	for i := range forkRoot {
		forkRoot[i] = 0x42
	}
	fork := mustCreateCheckpoint(t, mSK, "monkeys", 8, forkRoot)
	tampered := mustCorruptSignature(t, mNext)

	files := map[string][]byte{
		"first.note":     mInit,
		"successor.note": mNext,
		"fork.note":      fork,
		"tampered.note":  tampered,
	}
	for name, b := range files {
		if err := os.WriteFile(filepath.Join(fixtures, name), b, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	proof := make([]string, 0, len(consProof))
	for _, p := range consProof {
		proof = append(proof, base64.StdEncoding.EncodeToString(p))
	}
	meta := map[string]any{
		"origin":                "monkeys",
		"log_vkey":              mPK,
		"consistency_proof_b64": proof,
	}
	mb, _ := json.MarshalIndent(meta, "", "  ")
	if err := os.WriteFile(filepath.Join(fixtures, "metadata.json"), append(mb, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	w := newWitness(t, []logOpts{{origin: "monkeys", PK: mPK}})
	result := uuResult{
		Schema: "urn:uu-aap:reference-witness-observation:0.1",
		Cases:  map[string]uuCase{},
	}

	_, _, err := w.Update(ctx, 0, mInit, nil)
	if err != nil {
		t.Fatalf("first sight: %v", err)
	}
	result.Cases["first_sight"] = uuCase{Semantic: "ACCEPT_FIRST"}

	_, _, err = w.Update(ctx, 5, mNext, consProof)
	if err != nil {
		t.Fatalf("successor: %v", err)
	}
	result.Cases["append_only_successor"] = uuCase{Semantic: "ACCEPT_SUCCESSOR"}

	_, _, err = w.Update(ctx, 8, mInit, nil)
	if got := uuSemantic(err); got != "REJECT_ROLLBACK" {
		t.Fatalf("rollback semantic=%s err=%v", got, err)
	}
	result.Cases["rollback_replay"] = uuCase{Semantic: "REJECT_ROLLBACK", RawError: err.Error()}

	_, _, err = w.Update(ctx, 8, fork, nil)
	if got := uuSemantic(err); got != "REJECT_CONFLICT_SAME_SIZE" {
		t.Fatalf("fork semantic=%s err=%v", got, err)
	}
	result.Cases["same_size_conflict"] = uuCase{Semantic: "REJECT_CONFLICT_SAME_SIZE", RawError: err.Error()}

	_, _, err = w.Update(ctx, 8, tampered, nil)
	if got := uuSemantic(err); got != "REJECT_INVALID_SIGNATURE" {
		t.Fatalf("invalid signature semantic=%s err=%v", got, err)
	}
	result.Cases["invalid_signature"] = uuCase{Semantic: "REJECT_INVALID_SIGNATURE", RawError: err.Error()}

	b, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outPath, append(b, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}
}
