export default defineBackground({
  main() {
    console.log("Hello background!", { id: browser.runtime.id });
  },
});
