"use client";
import { useEffect, useRef } from "react";
import { ru } from "@/i18n/ru";
import styles from "./App.module.css";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className={styles.close} onClick={onClose} aria-label={ru.cancel}>
        ×
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
