// Loads the mystical/premium tarot fonts bundled with the app.
// - Cinzel (display) for big headings and card titles
// - Cormorant Garamond (serif) for medium headings and decorative subtitles
// Body text uses the platform default sans-serif (max readability).

import { useFonts } from "expo-font";

export const useAppFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    "Cinzel": require("../../assets/fonts/Cinzel-Variable.ttf"),
    "CormorantGaramond": require("../../assets/fonts/CormorantGaramond-Variable.ttf"),
    "CormorantGaramond-Italic": require("../../assets/fonts/CormorantGaramond-Italic-Variable.ttf"),
    "Inter": require("../../assets/fonts/Inter-Variable.ttf"),
    "Inter-Italic": require("../../assets/fonts/Inter-Italic-Variable.ttf"),
  });
