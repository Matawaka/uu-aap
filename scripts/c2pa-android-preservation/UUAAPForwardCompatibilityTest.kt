package org.contentauth.c2pa

import java.io.File
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import org.contentauth.c2pa.manifest.AssertionDefinition
import org.contentauth.c2pa.manifest.ClaimGeneratorInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UUAAPForwardCompatibilityTest {
    private val extensionKey = "org.example.uu_aap_reference"

    private fun fixture(name: String): String = when (name) {
        "claim" -> File(requireNotNull(System.getenv("UU_AAP_CLAIM_FIXTURE"))).readText()
        "external" -> File(requireNotNull(System.getenv("UU_AAP_EXTERNAL_REFERENCE_FIXTURE"))).readText()
        else -> error("unknown fixture: $name")
    }

    @Test
    fun externalReferenceRoundTripsThroughGenericAssertionPath() {
        val json = C2PAJson.default
        val inputText = fixture("external")
        val input = json.parseToJsonElement(inputText)

        val assertion = try {
            json.decodeFromString<AssertionDefinition>(inputText)
        } catch (error: Exception) {
            throw AssertionError("external-reference decode failed: ${error::class.qualifiedName}: ${error.message}", error)
        }

        assertTrue(
            "c2pa.external-reference should remain a generic custom assertion at this Android frontier",
            assertion is AssertionDefinition.Custom,
        )
        val custom = assertion as AssertionDefinition.Custom
        assertEquals("c2pa.external-reference", custom.label)

        val outputText = try {
            json.encodeToString(assertion)
        } catch (error: Exception) {
            throw AssertionError("external-reference encode failed: ${error::class.qualifiedName}: ${error.message}", error)
        }
        val output = json.parseToJsonElement(outputText)
        assertEquals(
            "standard external-reference payload changed across Android decode/encode",
            input,
            output,
        )
    }

    @Test
    fun modeledClaimToleratesButDoesNotPreserveUnknownNestedField() {
        val json = C2PAJson.default
        val inputText = fixture("claim")
        val input = json.parseToJsonElement(inputText).jsonObject
        assertTrue("fixture must contain the unknown nested extension", input.containsKey(extensionKey))

        val claim = try {
            json.decodeFromString<ClaimGeneratorInfo>(inputText)
        } catch (error: Exception) {
            throw AssertionError("ClaimGeneratorInfo tolerant decode failed: ${error::class.qualifiedName}: ${error.message}", error)
        }

        val outputText = try {
            json.encodeToString(claim)
        } catch (error: Exception) {
            throw AssertionError("ClaimGeneratorInfo encode failed: ${error::class.qualifiedName}: ${error.message}", error)
        }
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
