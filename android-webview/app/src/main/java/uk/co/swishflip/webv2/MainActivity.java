package uk.co.swishflip.webv2;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String HOME = "https://swishflip.co.uk/niches";
    private static final int FILE_PICKER = 3101;
    private static final int CAMERA_PERMISSION = 3102;
    private WebView web;
    private View offline;
    private boolean pageError;
    private ValueCallback<Uri[]> chooserCallback;
    private Uri capturedPhoto;
    private PermissionRequest requestedCamera;

    private static boolean trusted(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        String h = host.toLowerCase(Locale.ROOT);
        return h.equals("swishflip.co.uk") || h.endsWith(".swishflip.co.uk");
    }

    private void external(Uri uri) {
        if (uri == null) return;
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) &&
            !"mailto".equalsIgnoreCase(scheme) &&
            !"tel".equalsIgnoreCase(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No application can open this link", Toast.LENGTH_SHORT).show();
        }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(9, 8, 12));
        getWindow().setNavigationBarColor(Color.rgb(9, 8, 12));
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(Gravity.CENTER);
        error.setPadding(28, 28, 28, 28);
        error.setBackgroundColor(Color.rgb(9, 8, 12));
        TextView message = new TextView(this);
        message.setText("Cannot load SWISHWEB V2. Check your internet connection and the live website.");
        message.setTextSize(17);
        message.setTextColor(Color.WHITE);
        message.setGravity(Gravity.CENTER);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> {
            pageError = false;
            offline.setVisibility(View.GONE);
            web.loadUrl(HOME);
        });
        error.addView(retry);
        root.addView(error, new FrameLayout.LayoutParams(-1, -1));
        offline = error;
        offline.setVisibility(View.GONE);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (trusted(request.getUrl())) return false;
                external(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                pageError = false;
                offline.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    pageError = true;
                    offline.setVisibility(View.VISIBLE);
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                pageError = true;
                offline.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (pageError || !trusted(Uri.parse(url))) return;
                offline.setVisibility(View.GONE);
                // WebView follows the page's responsive viewport. Prevent sideways rubber-banding.
                view.evaluateJavascript("(function(){var d=document.documentElement,b=document.body;"
                    + "d.style.maxWidth='100%';d.style.overflowX='hidden';"
                    + "if(b){b.style.maxWidth='100%';b.style.overflowX='hidden';}})()", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!trusted(request.getOrigin())) { request.deny(); return; }
                    boolean asksForCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) asksForCamera = true;
                    }
                    if (!asksForCamera) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (requestedCamera != null) requestedCamera.deny();
                        requestedCamera = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
                    }
                });
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (requestedCamera == request) requestedCamera = null;
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                        FileChooserParams params) {
                if (chooserCallback != null) chooserCallback.onReceiveValue(null);
                chooserCallback = callback;
                capturedPhoto = null;

                String mime = "image/*";
                String[] accepted = params.getAcceptTypes();
                if (accepted != null && accepted.length > 0 && accepted[0] != null &&
                    !accepted[0].isEmpty()) mime = accepted[0];
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType(mime);
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                    params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);

                Intent camera = null;
                if (mime.startsWith("image/") || "*/*".equals(mime)) {
                    try {
                        File dir = new File(getCacheDir(), "captures");
                        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Capture directory missing");
                        File file = File.createTempFile("swish_", ".jpg", dir);
                        capturedPhoto = FileProvider.getUriForFile(MainActivity.this,
                            getPackageName() + ".fileprovider", file);
                        camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        camera.putExtra(MediaStore.EXTRA_OUTPUT, capturedPhoto);
                        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        camera.setClipData(ClipData.newRawUri("SWISH photo", capturedPhoto));
                    } catch (IOException | IllegalArgumentException ignored) {
                        capturedPhoto = null;
                    }
                }
                Intent chooser = Intent.createChooser(pick, "Choose or take a photo");
                if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,
                    new Intent[]{camera});
                try {
                    startActivityForResult(chooser, FILE_PICKER);
                } catch (ActivityNotFoundException e) {
                    chooserCallback.onReceiveValue(null);
                    chooserCallback = null;
                    Toast.makeText(MainActivity.this, "No photo picker found", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        web.loadUrl(HOME);
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != FILE_PICKER || chooserCallback == null) return;
        Uri[] chosen = null;
        if (result == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData clip = data.getClipData();
                chosen = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) chosen[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                chosen = new Uri[]{data.getData()};
            } else if (capturedPhoto != null) {
                chosen = new Uri[]{capturedPhoto};
            }
        }
        chooserCallback.onReceiveValue(chosen);
        chooserCallback = null;
        capturedPhoto = null;
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != CAMERA_PERMISSION || requestedCamera == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            requestedCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            requestedCamera.deny();
        }
        requestedCamera = null;
    }

    @Override public void onBackPressed() {
        if (offline.getVisibility() != View.VISIBLE && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (chooserCallback != null) chooserCallback.onReceiveValue(null);
        if (requestedCamera != null) requestedCamera.deny();
        if (web != null) {
            ((ViewGroup)web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
