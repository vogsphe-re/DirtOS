export async function readFile(): Promise<never> {
  throw new Error(
    "File attachments are not supported by the DirtOS ntfy integration in the desktop UI.",
  );
}

const fsPromisesShim = {
  readFile,
};

export default fsPromisesShim;
