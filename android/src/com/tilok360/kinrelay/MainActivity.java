package com.tilok360.kinrelay;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Kin Relay for Android: a thin shell around a WebView that shows the same app as the web version, from files bundled in
 * the APK (assets/web). The app's pages are served from a private address (https://appassets.androidplatform.net/) that
 * exists only inside this app. It asks for the INTERNET permission only: no storage, camera, contacts or location.
 * Your API key and characters live in this app's own storage and are never sent anywhere except the key to Kindroid's API.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int PICK = 41;
    private WebView web;
    private ValueCallback<Uri[]> chooser;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage and IndexedDB
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // a relay on your home network may be plain http
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " KinRelayAndroid/" + BuildInfo.VERSION);
        web.addJavascriptInterface(new Bridge(), "KinRelayAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                return serve(u);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* no browser */ }
                return true; // never navigate this window away from the app
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*"); // .gz, .json and .jsonl have no reliable type on Android
                try { startActivityForResult(Intent.createChooser(i, "Choose a file"), PICK); }
                catch (Exception e) { chooser = null; return false; }
                return true;
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code != PICK || chooser == null) { super.onActivityResult(code, result, data); return; }
        Uri[] r = null;
        if (result == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
        chooser.onReceiveValue(r);
        chooser = null;
    }

    @Override
    public boolean onKeyDown(int k, KeyEvent e) {
        if (k == KeyEvent.KEYCODE_BACK && web.canGoBack()) { web.goBack(); return true; }
        return super.onKeyDown(k, e);
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    // The bundled web app. Every answer carries CORS headers so the sandboxed game frames and the app's workers can use it.
    private WebResourceResponse serve(Uri u) {
        String p = u.getPath();
        if (p == null || p.equals("/") || p.isEmpty()) p = "/index.html";
        if (p.contains("..")) return notFound();
        try {
            InputStream in = getAssets().open("web" + p);
            String ext = MimeTypeMap.getFileExtensionFromUrl(p);
            String mime = mimeFor(p, ext);
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            h.put("Cache-Control", "no-cache");
            WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "utf-8" : null, in);
            r.setStatusCodeAndReasonPhrase(200, "OK");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) { return notFound(); }
    }
    private WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new java.io.ByteArrayInputStream("Not found".getBytes()));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }
    private static String mimeFor(String p, String ext) {
        String l = p.toLowerCase();
        if (l.endsWith(".js") || l.endsWith(".mjs")) return "text/javascript";
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json") || l.endsWith(".webmanifest")) return "application/json";
        if (l.endsWith(".svg")) return "image/svg+xml";
        String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m != null ? m : "application/octet-stream";
    }

    /** What the page can ask of the phone: save an exported characters file to Downloads. */
    private class Bridge {
        @JavascriptInterface
        public String version() { return BuildInfo.VERSION; }

        @JavascriptInterface
        public void saveFile(String name, String base64) {
            String safe = name == null ? "kin-relay.json" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safe.isEmpty() || safe.startsWith(".")) safe = "kin-relay.json";
            final String fileName = safe;
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IOException("no place to save");
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(data); }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    try (FileOutputStream o = new FileOutputStream(new File(dir, fileName))) { o.write(data); }
                }
                toast(Build.VERSION.SDK_INT >= 29 ? "Saved to Downloads: " + fileName : "Saved in the app's Downloads folder: " + fileName);
            } catch (Exception e) { toast("Couldn't save the file: " + e.getMessage()); }
        }
        private void toast(final String t) { runOnUiThread(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_LONG).show()); }
    }
}
