import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import com.android.uiautomator.core.UiAutomationShellWrapper;
import java.util.ArrayList;
import java.util.List;

/**
 * excer-bot 가린 칸 누르기(2026-11-01). 다른 창(보이스룸 작은 창 같은)이 위를 덮은 칸을 자리로 누르면 덮은 창이 눌리므로,
 * 그 칸을 앱 창들에서 찾아 접근성 누르기(길게 누르기)를 한다. 화면 읽기 도우미(ExcerDump)와 따로 둔다(읽기는 그대로).
 * 실행: CLASSPATH=/system/framework/uiautomator.jar:/data/local/tmp/excer_click.jar
 *       app_process /system/bin ExcerClick 왼 위 오른 아래 앱패키지 글자hex(없으면 -) [long]
 * 그 자리(1 픽셀까지)이고 글자나 이름이 같은 칸, 그 칸이 누를 수 없으면 누를 수 있는 윗칸(여섯 칸까지). 결과 한 줄:
 * clicked 몇칸위, refused(받지 않음), not-found(그 칸 없음), no-root(화면 못 읽음)
 */
public class ExcerClick {
    public static void main(String[] args) throws Exception {
        int l = Integer.parseInt(args[0]), t = Integer.parseInt(args[1]), r = Integer.parseInt(args[2]), b = Integer.parseInt(args[3]);
        String pkg = args.length > 4 ? args[4] : "";
        String want = args.length > 5 && !"-".equals(args[5]) ? unhex(args[5]) : null;
        boolean lng = args.length > 6 && "long".equals(args[6]);
        String res = "no-root";
        UiAutomationShellWrapper wrap = new UiAutomationShellWrapper();
        wrap.connect();
        wrap.setCompressedLayoutHierarchy(false);
        try {
            UiAutomation ua = wrap.getUiAutomation();
            try {
                AccessibilityServiceInfo info = ua.getServiceInfo();
                if (info != null) {
                    info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
                    ua.setServiceInfo(info);
                }
            } catch (Throwable e) {
                // 그대로
            }
            List<AccessibilityNodeInfo> roots = new ArrayList<AccessibilityNodeInfo>();
            try {                                    // 그 앱의 창들(앱 창이 먼저)
                List<AccessibilityWindowInfo> ws = ua.getWindows();
                for (int pass = 0; pass < 2 && ws != null; pass++) {
                    for (AccessibilityWindowInfo wi : ws) {
                        if ((wi.getType() == AccessibilityWindowInfo.TYPE_APPLICATION) != (pass == 0)) continue;
                        AccessibilityNodeInfo rt = null;
                        try {
                            rt = wi.getRoot();
                        } catch (Throwable e) {
                            rt = null;
                        }
                        CharSequence rp = rt != null ? rt.getPackageName() : null;
                        if (rt != null && (pkg.length() == 0 || pkg.equals(rp != null ? rp.toString() : ""))) roots.add(rt);
                    }
                }
            } catch (Throwable e) {
                // 창 목록을 못 읽으면 활성 창만
            }
            if (roots.isEmpty()) {
                AccessibilityNodeInfo rt = ua.getRootInActiveWindow();
                if (rt != null) roots.add(rt);
            }
            if (!roots.isEmpty()) {
                AccessibilityNodeInfo hit = null;
                for (int i = 0; i < roots.size() && hit == null; i++) hit = find(roots.get(i), l, t, r, b, want, 0);
                if (hit == null) {
                    res = "not-found";
                } else {
                    int act = lng ? AccessibilityNodeInfo.ACTION_LONG_CLICK : AccessibilityNodeInfo.ACTION_CLICK;
                    AccessibilityNodeInfo c = hit;
                    int up = 0;
                    while (c != null && !(lng ? c.isLongClickable() : c.isClickable()) && up < 6) {
                        c = c.getParent();
                        up++;
                    }
                    boolean ok = c != null && c.performAction(act);
                    if (!ok && c != hit) {
                        ok = hit.performAction(act);
                        up = 0;
                    }
                    res = ok ? "clicked " + up : "refused";
                }
            }
        } finally {
            wrap.disconnect();
        }
        System.out.println(res);
    }

    static AccessibilityNodeInfo find(AccessibilityNodeInfo n, int l, int t, int r, int b, String want, int depth) {
        if (n == null || depth > 90) return null;
        Rect rc = new Rect();
        n.getBoundsInScreen(rc);
        if (Math.abs(rc.left - l) <= 1 && Math.abs(rc.top - t) <= 1 && Math.abs(rc.right - r) <= 1 && Math.abs(rc.bottom - b) <= 1
                && (want == null || want.equals(str(n.getText())) || want.equals(str(n.getContentDescription())))) return n;
        int c = n.getChildCount();
        for (int i = 0; i < c; i++) {
            AccessibilityNodeInfo k = null;
            try {
                k = n.getChild(i);
            } catch (Exception e) {
                k = null;   // 읽는 사이에 바뀐 칸은 건너뛴다
            }
            if (k != null && k.isVisibleToUser()) {
                AccessibilityNodeInfo h = find(k, l, t, r, b, want, depth + 1);
                if (h != null) return h;
            }
        }
        return null;
    }

    static String str(CharSequence v) {
        return v == null ? "" : v.toString();
    }

    static String unhex(String s) throws Exception {
        byte[] bs = new byte[s.length() / 2];
        for (int i = 0; i < bs.length; i++) bs[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return new String(bs, "UTF-8");
    }
}
