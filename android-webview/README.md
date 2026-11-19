# SWISHWEB V2 — WebView test APK

This is a lightweight Android WebView wrapper. It loads the **published** SWISHWEB V2 website at https://swishflip.co.uk/niches; it does not bundle a second copy of the site.

It uses the website's existing authentication, shared OnSpace Cloud backend, inventory, and eBay listing code. It has a separate test package ID, so it does not overwrite the existing SWISH Android app.

Camera and barcode input via getUserMedia, plus native camera/photo picking via HTML file inputs, are included for testing. The Android back button follows WebView page history. Network failures show a Retry button. External eBay login/payment pages open in the system browser: completing OAuth and returning to the WebView session **requires real-device verification** and might need a future callback/deep link.

The wrapper disables zoom and horizontal overscroll and constrains page width. It cannot resolve every overflowing component in the site's own CSS; fix those at source if observed.

## GitHub build and download

Open **Actions → SWISH WebView Test APK** in the SwishWeb-v2 repository. After a successful run, download **SWISHWEB-V2-WebView-test** under **Artifacts**, unzip and install the APK. You may need to permit installation from your file manager.

GitHub builds a **debug-signed test APK**, not a Play Store release; a production update would need release signing. Changes published to the website appear automatically without APK rebuilds. Native Android feature or permission changes would still require a replacement APK.

No OnSpace database changes, new server or OTA channel are involved. The website must itself be published and reachable for the app to work.
