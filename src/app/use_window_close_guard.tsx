/**
 * 窗口关闭未保存确认 hook.
 * - 首次 closeRequested 始终 preventDefault()（阻止 Tauri 内部 destroy）
 * - 通过 allowCloseRef 放行第二次 closeRequested
 * - ref 同步最新 isDirty/currentPath/doSave，避免闭包旧值
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";

export interface WindowCloseGuardOptions {
  isDirty: boolean;
  doSave: () => Promise<boolean>;
  autoSaveStatus: "idle" | "saving" | "error";
}

export interface WindowCloseGuardResult {
  closeGuardDialog: React.JSX.Element;
}

export function useWindowCloseGuard(options: WindowCloseGuardOptions): WindowCloseGuardResult {
  const { isDirty, doSave, autoSaveStatus } = options;

  // ── ref 同步最新状态 ──
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  const autoSaveStatusRef = useRef(autoSaveStatus);
  useEffect(() => { autoSaveStatusRef.current = autoSaveStatus; }, [autoSaveStatus]);

  // ── 对话框状态 ──
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── 防止重复弹窗 ──
  const isDialogOpenRef = useRef(false);

  // ── 第二次 closeRequested 放行标志 ──
  const allowCloseRef = useRef(false);

  const openDialog = useCallback(() => {
    if (isDialogOpenRef.current) return;
    isDialogOpenRef.current = true;
    console.log("[CLOSE_GUARD] open dialog");
    setDialogOpen(true);
  }, []);

  // ── 按钮回调 ──
  const handleSaveAndClose = useCallback(async () => {
    console.log("[CLOSE_GUARD] save and close");
    isDialogOpenRef.current = false;
    setDialogOpen(false);

    const ok = await doSaveRef.current();
    if (ok) {
      allowCloseRef.current = true;
      await getCurrentWindow().close();
    }
  }, []);

  const handleDiscardAndClose = useCallback(() => {
    console.log("[CLOSE_GUARD] discard and close");
    isDialogOpenRef.current = false;
    setDialogOpen(false);
    allowCloseRef.current = true;
    void getCurrentWindow().close();
  }, []);

  const handleCancelClose = useCallback(() => {
    console.log("[CLOSE_GUARD] cancel close");
    isDialogOpenRef.current = false;
    setDialogOpen(false);
  }, []);

  // ── closeRequested 监听 ──
  useEffect(() => {
    console.log("[CLOSE_GUARD] hook mounted");

    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      console.log("[CLOSE_GUARD] register start");

      try {
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async (event) => {
          console.log("[CLOSE_GUARD] close requested");

          if (allowCloseRef.current) {
            console.log("[CLOSE_GUARD] allow native close (second invocation)");
            return;
          }

          // 始终阻止 Tauri 默认 close（内部调用 destroy，需要 allow-destroy）
          event.preventDefault();

          const dirty = isDirtyRef.current;
          const saving = autoSaveStatusRef.current === "saving";
          console.log("[CLOSE_GUARD] snapshot", { isDirty: dirty, isSaving: saving });

          if (!dirty && !saving) {
            console.log("[CLOSE_GUARD] clean, allow close");
            allowCloseRef.current = true;
            await win.close();
            return;
          }

          if (saving) {
            console.log("[CLOSE_GUARD] auto-saving, wait");
            const check = setInterval(() => {
              if (autoSaveStatusRef.current !== "saving") {
                clearInterval(check);
                if (!isDirtyRef.current) {
                  allowCloseRef.current = true;
                  void win.close();
                } else {
                  openDialog();
                }
              }
            }, 200);
            return;
          }

          console.log("[CLOSE_GUARD] dirty, open dialog");
          openDialog();
        });

        if (!disposed) {
          console.log("[CLOSE_GUARD] register success");
        }
      } catch (error) {
        console.error("[CLOSE_GUARD] register failed", error);
      }
    };

    void setup();

    return () => {
      console.log("[CLOSE_GUARD] unlisten");
      disposed = true;
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  }, [openDialog]);

  const closeGuardDialog = (
    <ConfirmDialog
      open={dialogOpen}
      onClose={handleCancelClose}
      onSaveAndContinue={handleSaveAndClose}
      onDiscardAndContinue={handleDiscardAndClose}
      message="当前文档还有未保存的更改，关闭窗口前是否保存？"
      saveLabel="保存并退出"
      discardLabel="放弃更改"
      cancelLabel="取消"
    />
  );

  return { closeGuardDialog };
}
