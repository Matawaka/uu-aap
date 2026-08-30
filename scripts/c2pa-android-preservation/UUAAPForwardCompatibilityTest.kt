package org.contentauth.c2pa

import java.io.File
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import org.contentauth.c2pa.manifest.AssertionDefinition
import org.contentauth.c2pa.manifest.ClaimGeneratorInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class UUAAPForwardCompatibilityTest {
    private val extensionKey = "org.example.uu_aap_reference"
    private val stageMarker = File("/tmp/c2pa-android-external-reference-stage.txt")

    private fun fixture(name: String): String = when (name) {
        "claim" -> File(requireNotNull(System.getenv("UU_AAP_CLAIM_FIXTURE"))).readText()
        "external" -> File(requireNotNull(System.getenv("UU_AAP_EXTERNAL_REFERENCE_FIXTURE"))).readText()
        else -> error("unknown fixture: $name")
    }

    @Test
    fun externalReferenceGenericPathSurfacesExplicitIncompatibility() {
        val json = C2PAJson.default
        val inputText = fixture("external")
        val input = json.parseToJsonElement(inputText)

        val assertion = try {
            json.decodeFromString<AssertionDefinition>(inputText)
        } catch (error: SerializationException) {
            stageMarker.writeText("decode_rejected\n${error::class.qualifiedName}\n${error.message.orEmpty()}\n")
            return
        }

        assertTrue(
            "if decode succeeds, c2pa.external-reference must remain a generic custom assertion",
            assertion is AssertionDefinition.Custom,
        )
        val custom = assertion as AssertionDefinition.Custom
        assertEquals("c2pa.external-reference", custom.label)

        val outputText = try {
            json.encodeToString(assertion)
        } catch (error: SerializationException) {
            stageMarker.writeText("encode_rejected\n${error::class.qualifiedName}\n${error.message.orEmpty()}\n")
            return
        }

        val output = json.parseToJsonElement(outputText)
        if (input == output) {
            stageMarker.writeText("semantic_roundtrip_passed\n")
            fail("Android external-reference generic path now round-trips semantically; frontier changed and receipt must be reclassified")
        }

        stageMarker.writeText("semantic_roundtrip_lossy\n")
        fail("Android external-reference generic path re-encoded with semantic loss; classify this new frontier explicitly")
    }

    @Test
    fun modeledClaimToleratesButDoesNotPreserveUnknownNestedField() {
        val json = C2PAJson.default
        val inputText = fixture("claim")
        val input = json.parseToJsonElement(inputText).jsonObject
        assertTrue("fixture must contain the unknown nested extension", input.containsKey(extensionKey))

        val claim = json.decodeFromString<ClaimGeneratorInfo>(inputText)
        val outputText = json.encodeToString(claim)
        val output = json.parseToJsonElement(outputText).jsonObject

        assertFalse(
            "current Android ClaimGeneratorInfo unexpectedly preserved the unknown nested extension; frontier changed",
            output.containsKey(extensionKey),
        )

        val forbiddenPromotions = listOf(
            "author",
            "authority",
            "responsibility",
            "trust",
            "trusted",
            "publication_authorization",
        )
        forbiddenPromotions.forEach { key ->
            assertFalse(
                "dropped extension was unexpectedly promoted into governance/trust key: $key",
                output.containsKey(key) && !input.containsKey(key),
            )
        }
    }
}
