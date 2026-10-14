import { HTMLAttributes } from "react";
import styles from "./Card.module.css";
export function Card(props: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`${styles.card} ${props.className ?? ""}`} />
  );
}
