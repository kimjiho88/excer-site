package android.view.accessibility;
public final class AccessibilityWindowInfo {
    public static final int TYPE_APPLICATION = 1;
    public int getType() { return 0; }
    public int getLayer() { return 0; }
    public int getId() { return 0; }
    public boolean isInPictureInPictureMode() { return false; }
    public boolean isActive() { return false; }
    public boolean isFocused() { return false; }
    public AccessibilityNodeInfo getRoot() { return null; }
    public void getBoundsInScreen(android.graphics.Rect r) {}
}
