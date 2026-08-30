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

    @Test
    fun externalReferenceIsPreservedWhileUnknownNestedClaimFieldIsDropped() {
        val claimPath = requireNotNull(System.getenv("UU_AAP_CLAIM_FIXTURE"))
        val externalReferencePath = requireNotNull(System.getenv("UU_AAP_EXTERNAL_REFERENCE_FIXTURE"))
        val json = C2PAJson.default

        val externalInputText = File(externalReferencePath).readText()
        val externalInput = json.parseToJsonElement(externalInputText)
        val assertion = json.decodeFromString<AssertionDefinition>(externalInputText)

        assertTrue(
            "c2pa.external-reference should remain a generic custom assertion at this Android frontier",
            assertion is AssertionDefinition.Custom,
        )
        val custom = assertion as AssertionDefinition.Custom
        assertEquals("c2pa.external-reference", custom.label)

        val externalOutputText = json.encodeToString(assertion)
        val externalOutput = json.parseToJsonElement(externalOutputText)
        assertEquals(
            "standard external-reference payload changed across Android decode/encode",
            externalInput,
            externalOutput,
        )

        val claimInputText = File(claimPath).readText()
        val claimInput = json.parseToJsonElement(claimInputText).jsonObject
        assertTrue("fixture must contain the unknown nested extension", claimInput.containsKey(extensionKey))

        val claim = json.decodeFromString<ClaimGeneratorInfo>(claimInputText)
        val claimOutputText = json.encodeToString(claim)
        val claimOutput = json.parseToJsonElement(claimOutputText).jsonObject

        assertFalse(
            "current Android ClaimGeneratorInfo unexpectedly preserved the unknown nested extension; frontier changed",
            claimOutput.containsKey(extensionKey),
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
                claimOutput.containsKey(key) && !claimInput.containsKey(key),
            )
        }
    }
}
