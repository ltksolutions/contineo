/**
 * Typy k `@toast-ui/editor`.
 *
 * Balík typy má (`types/index.d.ts`), ale nesprístupňuje ich cez `exports`
 * v `package.json`, takže ich TypeScript pri `moduleResolution: bundler`
 * nenájde. Toto je premostenie — nie vlastná definícia, len ukázanie na tú
 * ich, aby sa nestratila pri aktualizácii.
 */
declare module "@toast-ui/editor" {
  import Editor from "@toast-ui/editor/types"
  export * from "@toast-ui/editor/types"
  export default Editor
}

declare module "@toast-ui/editor/dist/toastui-editor.css"
