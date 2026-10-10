import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import com.android.uiautomator.core.UiAutomationShellWrapper;
import java.io.FileOutputStream;
import java.util.List;

/**
 * excer-bot 화면 읽기. uiautomator dump 와 같은 모양의 XML 을 쓴다.
 * uiautomator dump 는 화면이 1초 동안 멈춰야 읽는데(바쁜 대화방에서는 끝내 못 읽음),
 * 이것은 잠깐만 기다리고 그대로 읽는다.
 * 화면의 창 목록도 window 칸으로 적는다(종류, 겹친 차례, 활성, 작은 화면(PiP), 읽은 창, 앱, 자리). 활성 창이 그 앱의 작은 덧창
 * (보이스룸 작은 창 같은, 앱 창이 아니거나 작은 화면인 것)이면 그 앱의 가장 큰 앱 창을 읽는다(앱의 확인 창이나 메뉴 같은 앱 창은 그대로 읽는다).
 * 실행: CLASSPATH=/system/framework/uiautomator.jar:/data/local/tmp/excer_dump.jar
 *       app_process /system/bin ExcerDump 파일 [조용히 기다릴 ms] [최대 ms] [화면 폭] [화면 높이] [앱 패키지]
 */
public class ExcerDump {
    public static void main(String[] args) throws Exception {
        String out = args.length > 0 ? args[0] : "/data/local/tmp/excer_ui.xml";
        long quiet = args.length > 1 ? Long.parseLong(args[1]) : 200;
        long max = args.length > 2 ? Long.parseLong(args[2]) : 1200;
        int w = args.length > 3 ? Integer.parseInt(args[3]) : 0;
        int h = args.length > 4 ? Integer.parseInt(args[4]) : 0;
        String pkg = args.length > 5 ? args[5] : "";
        UiAutomationShellWrapper wrap = new UiAutomationShellWrapper();
        wrap.connect();
        wrap.setCompressedLayoutHierarchy(false);   // uiautomator dump 와 같게 덜 중요한 칸까지 모두
        try {
            UiAutomation ua = wrap.getUiAutomation();
            try {                                    // 창 목록도 읽게(안 되면 활성 창만)
                AccessibilityServiceInfo info = ua.getServiceInfo();
                if (info != null) {
                    info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
                    ua.setServiceInfo(info);
                }
            } catch (Throwable e) {
                // 그대로
            }
            try {
                ua.waitForIdle(quiet, max);
            } catch (Exception e) {
                // 바빠서 멈추지 않아도 그대로 읽는다
            }
            AccessibilityNodeInfo root = null;
            for (int i = 0; i < 20 && root == null; i++) {
                root = ua.getRootInActiveWindow();
                if (root == null) Thread.sleep(100);
            }
            StringBuilder wins = new StringBuilder();
            String picked = "active";
            try {
                List<AccessibilityWindowInfo> ws = ua.getWindows();
                int n = ws != null ? ws.size() : 0;
                AccessibilityNodeInfo[] roots = new AccessibilityNodeInfo[n];
                String[] pkgs = new String[n];
                Rect[] rs = new Rect[n];
                boolean[] pips = new boolean[n];
                AccessibilityNodeInfo big = null;
                long bigArea = 0;
                boolean activeSmall = false;
                for (int i = 0; i < n; i++) {
                    AccessibilityWindowInfo wi = ws.get(i);
                    rs[i] = new Rect();
                    wi.getBoundsInScreen(rs[i]);
                    try {
                        roots[i] = wi.getRoot();
                    } catch (Throwable e) {
                        roots[i] = null;
                    }
                    try {
                        pips[i] = wi.isInPictureInPictureMode();
                    } catch (Throwable e) {
                        pips[i] = false;
                    }
                    CharSequence wp = roots[i] != null ? roots[i].getPackageName() : null;
                    pkgs[i] = wp != null ? wp.toString() : "";
                    boolean mine = pkg.length() > 0 && pkg.equals(pkgs[i]);
                    boolean app = wi.getType() == AccessibilityWindowInfo.TYPE_APPLICATION && !pips[i];
                    if (wi.isActive() && mine && !app) activeSmall = true;
                    long area = (long) (rs[i].right - rs[i].left) * (long) (rs[i].bottom - rs[i].top);
                    if (roots[i] != null && mine && app && area > bigArea) {
                        big = roots[i];
                        bigArea = area;
                    }
                }
                if (big != null && (root == null || activeSmall)) {
                    root = big;
                    picked = "app";
                }
                int readId = root != null ? root.getWindowId() : -1;
                for (int i = 0; i < n; i++) {
                    AccessibilityWindowInfo wi = ws.get(i);
                    wins.append("<window type=\"").append(wi.getType()).append("\" layer=\"").append(wi.getLayer())
                        .append("\" active=\"").append(wi.isActive()).append("\" focused=\"").append(wi.isFocused())
                        .append("\" pip=\"").append(pips[i]).append("\" read=\"").append(readId != -1 && wi.getId() == readId).append('"');
                    attr(wins, "package", pkgs[i]);
                    wins.append(" bounds=\"[").append(rs[i].left).append(',').append(rs[i].top).append("][").append(rs[i].right).append(',').append(rs[i].bottom).append("]\" />");
                }
            } catch (Throwable e) {
                wins.setLength(0);                   // 창 목록을 못 읽으면 활성 창만
            }
            StringBuilder sb = new StringBuilder();
            sb.append("<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation=\"0\" picked=\"").append(picked).append("\">");
            sb.append(wins);
            if (root != null) node(root, sb, 0, w, h);
            sb.append("</hierarchy>");
            FileOutputStream f = new FileOutputStream(out);
            f.write(sb.toString().getBytes("UTF-8"));
            f.close();
            System.out.println(root == null ? "no-root" : "ok");
        } finally {
            wrap.disconnect();
        }
    }

    static void node(AccessibilityNodeInfo n, StringBuilder sb, int index, int w, int h) {
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        int l = r.left, t = r.top, rr = r.right, b = r.bottom;
        if (w > 0) { l = Math.max(0, Math.min(l, w)); rr = Math.max(0, Math.min(rr, w)); }
        if (h > 0) { t = Math.max(0, Math.min(t, h)); b = Math.max(0, Math.min(b, h)); }
        sb.append("<node index=\"").append(index).append('"');
        attr(sb, "text", n.getText());
        attr(sb, "resource-id", n.getViewIdResourceName());
        attr(sb, "class", n.getClassName());
        attr(sb, "package", n.getPackageName());
        attr(sb, "content-desc", n.getContentDescription());
        sb.append(" clickable=\"").append(n.isClickable()).append('"');
        sb.append(" long-clickable=\"").append(n.isLongClickable()).append('"');
        sb.append(" bounds=\"[").append(l).append(',').append(t).append("][").append(rr).append(',').append(b).append("]\">");
        int c = n.getChildCount();
        for (int i = 0; i < c; i++) {
            AccessibilityNodeInfo k = null;
            try {
                k = n.getChild(i);
            } catch (Exception e) {
                k = null;   // 읽는 사이에 바뀐 칸은 건너뛴다
            }
            if (k != null && k.isVisibleToUser()) node(k, sb, i, w, h);
        }
        sb.append("</node>");
    }

    static void attr(StringBuilder sb, String name, CharSequence v) {
        sb.append(' ').append(name).append("=\"");
        if (v != null) {
            String s = v.toString();
            for (int i = 0; i < s.length(); i++) {
                char ch = s.charAt(i);
                if (ch == '&') sb.append("&amp;");
                else if (ch == '<') sb.append("&lt;");
                else if (ch == '>') sb.append("&gt;");
                else if (ch == '"') sb.append("&quot;");
                else if (ch == '\n') sb.append("&#10;");
                else if (ch == '\r') sb.append("&#13;");
                else if (ch == '\t') sb.append("&#9;");
                else if (ch >= 0x20) sb.append(ch);
            }
        }
        sb.append('"');
    }
}
