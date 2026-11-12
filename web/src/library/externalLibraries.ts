export type ExternalLibrary = {
  id: string;
  name: string;
  /** Zip containing one exported library JSON file. */
  url: string;
  description: string;
};

export const EXTERNAL_LIBRARIES: ExternalLibrary[] = [
  {
    id: "named-models",
    name: "Named Models Library",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Named_Models.zip",
    description: "A collection of named models in Antiprism.",
  },
  {
    id: "commands-examples",
    name: "Examples of Commands ",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Commands_Examples.zip",
    description: "A list of examples from the Antiprism documentation.",
  },
  {
    id: "miratope",
    name: "Miratope Library",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Miratope.zip",
    description: "A collection of models from <a href='https://github.com/galoomba1/miratope-rs'>Miratope</a>.",
  },
  {
    id: "wagyx",
    name: "Wagyx's Library",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/Wagyx.zip",
    description: "A collection of models made by the author, Wagyx.",
  },
  {
    id: "conditional-edge",
    name: "CRF Conditional Edges Library",
    url: "https://asliceofcuriosity.fr/app/antiprism-pwa/libraries/CRF_Conditional_Edge.zip",
    description: "Convex regular-faced polyhedra with conditional edges by <a href='https://tupelo-schneck.org/polyhedra/'>Robert R Tupelo-Schneck</a>.",
  },
];
