export type ExternalLibrary = {
  id: string;
  name: string;
  /** Zip containing one exported library JSON file. */
  url: string;
};

export const EXTERNAL_LIBRARIES: ExternalLibrary[] = [
  {
    id: "named-models",
    name: "Named Models Library",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Named_Models.zip",
  },
  {
    id: "commands-examples",
    name: "Examples of Commands ",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Commands_Examples.zip",
  },
];
