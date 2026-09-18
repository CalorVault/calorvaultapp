import sys

def apply_edit(path, old, new, label):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        print(f"ERROR: {label} -- pattern not found in {path}")
        return False
    if content.count(old) > 1:
        print(f"ERROR: {label} -- pattern is ambiguous (appears more than once) in {path}")
        return False
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"SUCCESS: {label}")
    return True

apply_edit(
    "src/theme.ts",
    "  accentMuted: '#FBE3D3',\n",
    "  accentMuted: '#FBE3D3',\n  blueMuted: '#DBEAFE',\n",
    "theme.ts blueMuted color",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    "  ActivityIndicator,\n  Alert,\n  Animated,\n  LayoutChangeEvent,\n",
    "  ActivityIndicator,\n  Alert,\n  Animated,\n  Image,\n  LayoutChangeEvent,\n",
    "LogFoodScreen.tsx Image import",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    "const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];\nconst BARCODE_RESCAN_MS = 4000;\n",
    "const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];\nconst BARCODE_RESCAN_MS = 4000;\nconst MIN_ANALYZING_MS = 1400;\n\nfunction wait(ms: number): Promise<void> {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n",
    "LogFoodScreen.tsx MIN_ANALYZING_MS/wait",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    "function CameraTab() {",
    """function AnalyzingOverlay({ photoUri }: { photoUri?: string }) {
  const { t } = useApp();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const glyphScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <View style={styles.analyzingContainer}>
      {photoUri && (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} blurRadius={18} />
      )}
      <View style={styles.analyzingScrim} />
      <View style={styles.analyzingContent}>
        <View style={styles.analyzingPulseWrap}>
          <Animated.View
            style={[
              styles.analyzingRing,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          <Animated.View style={[styles.analyzingGlyph, { transform: [{ scale: glyphScale }] }]}>
            <SparkleIcon size={30} color={colors.white} />
          </Animated.View>
        </View>
        <Text style={styles.analyzingText}>{t.logFood.analyzingFood}</Text>
      </View>
    </View>
  );
}

function CameraTab() {""",
    "LogFoodScreen.tsx AnalyzingOverlay component",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    """      setPhotoUri(photo.uri);
      await runPhotoEstimate(photo.base64);
    } catch (err) {
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }""",
    """      setPhotoUri(photo.uri);
      await Promise.all([runPhotoEstimate(photo.base64), wait(MIN_ANALYZING_MS)]);
    } catch (err) {
      setPhotoUri(undefined);
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }""",
    "LogFoodScreen.tsx handleCapture min duration",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    """      setPhotoUri(result.assets[0].uri);
      await runPhotoEstimate(result.assets[0].base64);
    } catch (err) {
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }""",
    """      setPhotoUri(result.assets[0].uri);
      await Promise.all([runPhotoEstimate(result.assets[0].base64), wait(MIN_ANALYZING_MS)]);
    } catch (err) {
      setPhotoUri(undefined);
      Alert.alert(t.logFood.scanFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
    }
  }""",
    "LogFoodScreen.tsx handlePickFromGallery min duration",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    """  if (estimate) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <ReviewCard
          estimate={estimate}
          onChange={setEstimate}
          saving={saving}
          apiKey={apiKey}
          onDiscard={() => {
            setEstimate(null);
            setPhotoUri(undefined);
          }}
          onSave={async () => {
            setSaving(true);
            await save(estimate, scanMode === 'barcode' ? 'barcode' : 'camera', photoUri);""",
    """  if (capturing && photoUri && scanMode !== 'barcode') {
    return <AnalyzingOverlay photoUri={photoUri} />;
  }

  if (estimate) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <ReviewCard
          estimate={estimate}
          onChange={setEstimate}
          saving={saving}
          apiKey={apiKey}
          onDiscard={() => {
            setEstimate(null);
            setPhotoUri(undefined);
          }}
          onSave={async () => {
            setSaving(true);
            await save(estimate, scanMode === 'barcode' ? 'barcode' : 'camera', photoUri);""",
    "LogFoodScreen.tsx analyzing render branch",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    "  scannerContainer: { flex: 1, backgroundColor: colors.ink },\n",
    """  scannerContainer: { flex: 1, backgroundColor: colors.ink },
  analyzingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  analyzingContent: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  analyzingPulseWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
  },
  analyzingGlyph: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
""",
    "LogFoodScreen.tsx analyzing styles",
)

apply_edit(
    "src/screens/LogFoodScreen.tsx",
    "const TABS: Tab[] = ['manual', 'camera', 'voice', 'ask', 'recent'];",
    "const TABS: Tab[] = ['manual', 'camera', 'voice', 'recent'];",
    "LogFoodScreen.tsx remove Ask tab",
)

apply_edit(
    "src/components/QuickLogSheet.tsx",
    """          <View style={styles.quickRow}>
            <QuickButton icon="🔍" label={t.quickLog.search} onPress={() => onSelect('manual')} />
            <QuickButton icon="🍽️" label={t.quickLog.previousMeal} onPress={() => onSelect('recent')} />
            <QuickButton icon="⛶" label={t.quickLog.scan} onPress={() => onSelect('camera')} />
          </View>""",
    """          <View style={styles.quickRow}>
            <QuickButton
              icon="🔍"
              label={t.quickLog.search}
              tint={colors.blueMuted}
              onPress={() => onSelect('manual')}
            />
            <QuickButton
              icon="🍽️"
              label={t.quickLog.previousMeal}
              tint={colors.primaryMuted}
              onPress={() => onSelect('recent')}
            />
            <QuickButton
              icon="⛶"
              label={t.quickLog.scan}
              tint={colors.accentMuted}
              onPress={() => onSelect('camera')}
            />
          </View>""",
    "QuickLogSheet.tsx tinted buttons usage",
)

apply_edit(
    "src/components/QuickLogSheet.tsx",
    """function QuickButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickButton} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}""",
    """function QuickButton({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.quickButton, { backgroundColor: tint }]} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}""",
    "QuickLogSheet.tsx QuickButton tint prop",
)

i18n_edits = [
    ("src/i18n/en.ts", "    apiKeyNeededMsg: 'Add your Claude API key in Settings to enable food scanning.',\n",
     "analyzingFood: 'Analyzing your food...',"),
    ("src/i18n/ro.ts", "    apiKeyNeededMsg: 'Adaugă cheia ta API Claude în Setări pentru a activa scanarea alimentelor.',\n",
     "analyzingFood: 'Se analizează mâncarea...',"),
    ("src/i18n/fr.ts", "    apiKeyNeededMsg: 'Ajoute ta clé API Claude dans les Réglages pour activer le scan de nourriture.',\n",
     "analyzingFood: 'Analyse de ton repas...',"),
    ("src/i18n/it.ts", "    apiKeyNeededMsg: 'Aggiungi la tua chiave API Claude nelle Impostazioni per attivare la scansione del cibo.',\n",
     "analyzingFood: 'Analisi del cibo in corso...',"),
    ("src/i18n/es.ts", "    apiKeyNeededMsg: 'Añade tu clave API de Claude en Ajustes para activar el escaneo de comida.',\n",
     "analyzingFood: 'Analizando tu comida...',"),
    ("src/i18n/de.ts", "    apiKeyNeededMsg: 'Füge deinen Claude-API-Schlüssel in den Einstellungen hinzu, um den Lebensmittelscan zu aktivieren.',\n",
     "analyzingFood: 'Dein Essen wird analysiert...',"),
]
for path, old, new_line in i18n_edits:
    new = old.rstrip("\n") + "\n    " + new_line + "\n"
    apply_edit(path, old, new, f"{path} analyzingFood key")

print("DONE")
