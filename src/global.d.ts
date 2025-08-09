import type { QwikIntrinsicElements } from "@builder.io/qwik";

declare global {
  namespace JSX {
    interface IntrinsicElements extends QwikIntrinsicElements {
      script: QwikIntrinsicElements["script"] & { dangerouslySetInnerHTML?: any };
      style: QwikIntrinsicElements["style"] & { dangerouslySetInnerHTML?: any };
    }
  }
}