package com.lin.familystudy;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 把一段 HTML 交给 Android 系统打印(可选家里的打印机,或存为 PDF)。 */
@CapacitorPlugin(name = "PrintHtml")
public class PrintPlugin extends Plugin {
    // 持有引用,避免打印过程中 WebView 被回收
    private WebView printView;

    @PluginMethod
    public void print(final PluginCall call) {
        final String html = call.getString("html");
        final String title = call.getString("title", "家庭学习");
        if (html == null) {
            call.reject("缺少 html");
            return;
        }
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                printView = new WebView(getContext());
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        pm.print(title, view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
                        call.resolve();
                    }
                });
                printView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
            }
        });
    }
}
