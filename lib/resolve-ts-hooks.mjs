export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:[cm]?[jt]s|json|mjs|cjs)$/i.test(specifier)
  ) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      /* try the original specifier */
    }
  }
  return nextResolve(specifier, context);
}
