-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.zylod.wholesale.bridge.** { *; }
-keep class com.zylod.wholesale.data.model.** { *; }

# --- R8 / kotlinx.serialization (D3 fix) ---
# The Retrofit layer's @Serializable DTOs live in data.api (not data.model) and
# kotlinx.serialization looks their serializers up reflectively. Release builds
# minify (isMinifyEnabled), and CI only exercises debug — so keep the canonical
# serialization rules explicitly rather than relying on artifact consumer rules.
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

-keepclassmembers @kotlinx.serialization.Serializable class com.zylod.wholesale.data.api.** {
    *** Companion;
    <fields>;
    <init>(...);
}
-keep,includedescriptorclasses class com.zylod.wholesale.data.api.**$$serializer { *; }
