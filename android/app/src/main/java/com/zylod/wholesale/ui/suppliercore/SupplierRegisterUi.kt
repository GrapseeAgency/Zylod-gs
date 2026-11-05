package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import coil.compose.AsyncImage

/**
 * t270 — shared UI vocabulary for the supplier register wizard
 * ([SupplierRegisterScreen]): the Store header block, the progress bar +
 * step-header chips, the labeled text field, the read-only dropdown, the
 * dashed KYC document pick card (web `border-dashed` upload zone) and the
 * honest inline error alert. Everything mirrors the supplier-core card /
 * banner / chip idioms from [SupplierCoreUi] and SupplierGuideScreen — theme
 * colors only, red/rose accent family, NO blue/indigo. `internal` because
 * these pieces are consumed by the sibling screen file in this package.
 */

/** One step-header chip: the web STEPS array (label + icon glyph mapping). */
internal data class SupplierRegisterStepChip(
    val label: String,
    val icon: ImageVector,
)

/** Web STEPS — Store / FileText / Shield / Banknote → proven extended-set glyphs. */
internal val SUPPLIER_REGISTER_STEPS = listOf(
    SupplierRegisterStepChip("Company Info", Icons.Outlined.Storefront),
    SupplierRegisterStepChip("NID Upload", Icons.Outlined.Description),
    // t281 5-c: "License & TIN" (not "Trade License & TIN") — the full label
    // ellipsized to "Trade Licen…" in the ~76dp chip on 320dp AVDs (VLM run
    // 175, capture 62); the step card below keeps the full "Trade License" name.
    SupplierRegisterStepChip("License & TIN", Icons.Outlined.VerifiedUser),
    SupplierRegisterStepChip("Bank Details", Icons.Outlined.AccountBalance),
)

/** Step card descriptions (register-supplier-page.tsx CardDescription, verbatim). */
internal fun supplierRegisterStepDescription(step: Int): String = when (step) {
    1 -> "Tell us about your business"
    2 -> "Verify your identity with NID"
    3 -> "Provide trade license and TIN details"
    else -> "Set up your bank account for payments"
}

/** City dropdown: stored value (wire) + display label — web SelectItem pairs. */
internal val SUPPLIER_REGISTER_CITY_OPTIONS = listOf(
    "dhaka" to "Dhaka",
    "chittagong" to "Chittagong",
    "sylhet" to "Sylhet",
    "rajshahi" to "Rajshahi",
    "khulna" to "Khulna",
    "barishal" to "Barishal",
    "rangpur" to "Rangpur",
    "mymensingh" to "Mymensingh",
)

/** Business Type dropdown: stored value (wire) + display label. */
internal val SUPPLIER_REGISTER_BUSINESS_TYPE_OPTIONS = listOf(
    "manufacturer" to "Manufacturer",
    "wholesaler" to "Wholesaler",
    "trading" to "Trading Company",
    "factory" to "Factory",
)

/** The family card border — outline at the shared 0.5 alpha. */
@Composable
internal fun supplierRegisterCardBorder(): BorderStroke = BorderStroke(
    1.dp,
    MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
)

/**
 * Centered page header: the Store icon box, "Register as Supplier" and the
 * "Start selling on the B2B wholesale marketplace" subtitle (web 1:1).
 */
@Composable
internal fun SupplierRegisterHeader() {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary) {
            Icon(
                Icons.Outlined.Storefront,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier
                    .padding(12.dp)
                    .size(24.dp),
            )
        }
        Text(
            "Register as Supplier",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            "Start selling on the B2B wholesale marketplace",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/**
 * The web Progress (h-2) + the four step-header chips: completed/upcoming
 * steps tint primary, the active step sits on a primary-tinted pill with
 * bold label — the family's chip idiom, indicators only (never tappable).
 */
@Composable
internal fun SupplierRegisterProgress(step: Int) {
    Column(modifier = Modifier.fillMaxWidth()) {
        LinearProgressIndicator(
            progress = { step / SUPPLIER_REGISTER_STEPS.size.toFloat() },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
            strokeCap = StrokeCap.Round,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp),
        ) {
            SUPPLIER_REGISTER_STEPS.forEachIndexed { index, chip ->
                val isCurrent = step == index + 1
                val tint = when {
                    step >= index + 1 -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Surface(
                    shape = RoundedCornerShape(50),
                    color = if (isCurrent) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
                    } else {
                        Color.Transparent
                    },
                    modifier = Modifier.weight(1f),
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 2.dp, vertical = 6.dp),
                    ) {
                        Icon(chip.icon, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
                        Text(
                            chip.label,
                            fontSize = 9.sp,
                            lineHeight = 11.sp,
                            maxLines = 1,
                            // t277-1d: "Trade License & TIN" clipped mid-letter in
                            // the ~76dp chip on 360/320dp screens.
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                            color = tint,
                        )
                    }
                }
            }
        }
    }
}

/**
 * One labeled wizard field — OutlinedTextField at the family sizing (56dp
 * touch target), per-field KeyboardOptions, optional leading/trailing icons.
 */
@Composable
internal fun SupplierRegisterField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    leadingIcon: ImageVector? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        label = { Text(label, fontSize = 12.sp) },
        placeholder = { Text(placeholder, fontSize = 13.sp) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        visualTransformation = visualTransformation,
        leadingIcon = leadingIcon?.let { icon ->
            {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        },
        trailingIcon = trailingIcon,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    )
}

/**
 * Read-only ExposedDropdownMenuBox picker — the old RegisterSupplierScreen
 * dropdown pattern, family-styled. Stores the wire VALUE, shows the LABEL.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SupplierRegisterDropdown(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == value }?.second.orEmpty()
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label, fontSize = 12.sp) },
            placeholder = { Text("Select $label", fontSize = 13.sp) },
            shape = RoundedCornerShape(12.dp),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.second, fontSize = 13.sp) },
                    onClick = {
                        onSelected(option.first)
                        expanded = false
                    },
                )
            }
        }
    }
}

/**
 * One KYC document slot — the web dashed upload zone ported honestly:
 * unpicked shows the Upload glyph + hint in a dashed-border box; picked
 * shows the Coil preview of the picked content Uri plus the picked-state
 * row (filename, or "Selected" when the provider gave no display name)
 * with a Replace affordance. Tapping either re-opens the picker.
 */
@Composable
internal fun SupplierDocPickCard(
    label: String,
    hint: String,
    pick: SupplierDocPick?,
    enabled: Boolean,
    onPick: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(6.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .supplierRegisterDashedBorder(MaterialTheme.colorScheme.outline.copy(alpha = 0.7f))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                .clickable(onClick = onPick, enabled = enabled)
                .padding(2.dp),
        ) {
            if (pick != null) {
                Column {
                    AsyncImage(
                        model = pick.uri,
                        contentDescription = label,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(128.dp),
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text(
                            pick.displayName.ifBlank { "Selected" },
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(
                            onClick = onPick,
                            enabled = enabled,
                            modifier = Modifier.heightIn(min = 44.dp),
                        ) {
                            Text(
                                "Replace",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 28.dp),
                ) {
                    Icon(
                        Icons.Outlined.Upload,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(28.dp),
                    )
                    Text(
                        hint,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
    }
}

/**
 * Dashed rounded-rect outline (web `border-2 border-dashed`) — drawBehind
 * stroke with a dash PathEffect; insets by half the stroke so nothing clips.
 */
private fun Modifier.supplierRegisterDashedBorder(color: Color): Modifier = drawBehind {
    val strokeWidth = 2.dp.toPx()
    val dash = 10.dp.toPx()
    val gap = 6.dp.toPx()
    val radius = 12.dp.toPx()
    drawRoundRect(
        color = color,
        topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f),
        size = Size(size.width - strokeWidth, size.height - strokeWidth),
        cornerRadius = CornerRadius(radius, radius),
        style = Stroke(
            width = strokeWidth,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, gap)),
        ),
    )
}

/**
 * The inline error Alert (web Alert variant="destructive"): error-container
 * tint + border, ErrorOutline glyph, the message verbatim — the family
 * banner idiom recolored to the error slot (red/rose accent family).
 */
@Composable
internal fun SupplierRegisterErrorAlert(message: String) {
    Surface(
        color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.ErrorOutline,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                message,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * The quiet info notes under the NID and bank sections (web gray rows with
 * a leading Shield / Banknote glyph) — surfaceVariant surface, 12sp text.
 */
@Composable
internal fun SupplierRegisterNote(icon: ImageVector, text: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The primary wizard action button (Next / Submit) — guide CTA idiom. */
@Composable
internal fun SupplierRegisterPrimaryButton(
    text: String,
    loading: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
    ) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Spacer(Modifier.width(8.dp))
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            Icon(
                Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

/** The outlined Back button — guide CTA sizing, outline family border. */
@Composable
internal fun SupplierRegisterBackButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        border = supplierRegisterCardBorder(),
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
    ) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}
