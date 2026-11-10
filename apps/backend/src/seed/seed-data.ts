import { Types } from "mongoose";
import { normalizeAddress } from "../common/normalize-address";
import type { Person } from "../people/person.schema";
import type { Site } from "../sites/site.schema";
import {
  NavigationSource,
  VisitStatus,
  type Visit,
} from "../visits/visit.schema";

export const SEED_HISTORY_START = "2026-10-01T09:00:00.000Z";

export const SEED_PEOPLE = [
  { name: "Mira Qureshi" },
  { name: "Elias Mercer" },
  { name: "Ada Okafor" },
  { name: "Tomas Iqbal" },
] as const;

interface SeedPageDefinition {
  address: string;
  title: string;
  paragraphs: readonly string[];
  links: readonly (readonly [address: string, label: string])[];
}

/** Original prose about an invented harbor, not summaries of external pages. */
export const SEED_PAGES = [
  {
    address: "harbor.local",
    title: "A Walking Map of Brindle Harbor",
    paragraphs: [
      "Brindle Harbor is easiest to understand on foot. Begin beside the blue pump, where the canal bends around a row of narrow workshops. The painted arrows describe distances in minutes rather than miles. A ten-minute walk can take half an hour if someone opens a door to explain what they are making.",
      "The map keeps small uncertainties visible. A dotted line means the footpath floods at spring tide; a penciled gate means its owner has not promised public access. Neither mark is a mistake. A useful map tells a walker where to pay attention instead of pretending that every route stays the same.",
      "Take the old steps toward the water before visiting the gardens and market. Their stories fit together: water sets the working hours, gardens collect the rain, and the market trades what the neighborhood has learned. The ferry notice remains linked here even though its page has disappeared from the archive.",
    ],
    links: [
      ["tides.local", "Read the water at the old steps"],
      ["workshop.local", "Visit the canal repair bench"],
      ["ferry.local", "Consult the missing ferry notice"],
    ],
  },
  {
    address: "tides.local",
    title: "Reading Water at the Old Steps",
    paragraphs: [
      "The lowest stair carries a stripe of dark algae that looks like a ruler drawn by an impatient hand. Boat crews compare that stripe with the harbor clock, but neither instrument is enough by itself. Wind can hold water against the wall long after the printed tide table predicts its retreat.",
      "Mira records the time, wind direction, and number of exposed steps in a waterproof notebook. Her entries are observations rather than forecasts. An unusually high reading becomes useful only when another reader can see the conditions beside it. Keeping the messy context makes the small measurements trustworthy.",
      "Beyond the stairs, a narrow path follows the salt marsh. Look for the channels between the reeds, not just the open water. Those channels explain why a quiet-looking edge can still move quickly. Return by the upper walkway when the last two steps disappear, even if the sky remains perfectly clear.",
    ],
    links: [
      ["marsh.local", "Follow the channels into the reed beds"],
      ["harbor.local", "Return to the walking map"],
    ],
  },
  {
    address: "marsh.local",
    title: "The Reed Beds Keep a Ledger",
    paragraphs: [
      "At the edge of Brindle, the marsh writes its history in layers of silt. A pale band marks a season when builders disturbed the upstream bank. A darker layer holds fragments of last winter's reeds. Neither layer supplies a complete story, but together they record changes that a photograph would miss.",
      "Volunteers measure salinity in the same shallow pool each week. They rinse the jar twice, note recent rain, and leave the sampling place undisturbed. The aim is a patient comparison, not a dramatic number. A careful ordinary reading can become the most valuable entry after an unusual storm.",
      "The roof gardeners borrow this habit of small repeated observations. Their soil trays are younger than the marsh, yet both depend on water arriving at the right pace. An old bird register is mentioned in several notebooks; its address is preserved below although nobody has recovered the document itself.",
    ],
    links: [
      ["roofs.local", "See how the roof gardens collect rain"],
      ["tides.local", "Compare the old steps observations"],
      ["bird-register.local", "Look for the absent bird register"],
    ],
  },
  {
    address: "roofs.local",
    title: "Gardens Above the Rainline",
    paragraphs: [
      "The first roof garden began with six shallow trays and a rule against carrying heavy soil upstairs. Neighbors mixed crushed brick with compost, then tested how quickly a cup of water drained through it. The lightest successful mixture became the starting point for every tray that followed.",
      "Each garden has a rain ledger hanging inside the stairwell. Gardeners record the water they collect and the water they carry up by hand. These modest accounts reveal which plants suit the building better than a photograph of the greenest corner. A thriving planter that requires constant lifting is not always the best design.",
      "On Saturdays, spare seedlings go to the market in reusable wooden boxes. The boxes return with kitchen scraps for the next compost batch. Visitors can trace that exchange back through a whole season, provided they read the labels before admiring the leaves. The small circulation matters more than a perfect rooftop view.",
    ],
    links: [
      ["market.local", "Follow the seedling boxes to market"],
      ["harbor.local", "Find the stairwell on the walking map"],
    ],
  },
  {
    address: "market.local",
    title: "What the Saturday Stalls Remember",
    paragraphs: [
      "The Saturday market opens when the bread van parks beside the empty fish shed. Stallholders mark prices on slate so they can explain a change instead of hiding the old figure. A wet week might reduce the herb baskets while increasing the supply of repaired umbrellas. The arrangement follows the neighborhood rather than a fixed catalog.",
      "Mira keeps the labels that arrive with rooftop seedlings. They include sowing dates, uncertain plant names, and practical advice from people who learned by losing a crop. These handwritten scraps are evidence of decisions, not decorative packaging. At the end of a season, the archive stores a small representative bundle.",
      "The repair stall accepts things that can be examined safely on an open table. A broken handle can lead to a conversation about grain direction, spare parts, and whether repair is worth another person's time. The printed lantern catalog is still referenced by older labels, but its linked page is no longer present.",
    ],
    links: [
      ["archive.local", "Read the archive's notes on ordinary labels"],
      ["workshop.local", "Take a repair to the canal bench"],
      ["lantern-catalog.local", "Open the missing lantern catalog"],
    ],
  },
  {
    address: "archive.local",
    title: "A Small Archive with Long Margins",
    paragraphs: [
      "Elias sorts the harbor archive by the questions a document can answer. A receipt might explain the cost of a roof tray, while a postcard supplies the only readable name of a vanished boat. Keeping them in separate grand categories would make the collection tidier and much less useful to a curious visitor.",
      "A cyanotype of the old breakwater hangs beside a recent pencil map. The blue print records a railing that has since disappeared; the map records a safe place to stand now. Neither object replaces the other. Their disagreement is an invitation to ask when a detail was true and who needed to know it.",
      "Every folder leaves room for a correction slip. The archive preserves earlier claims beside the evidence that revised them, including links to missing records. At night, volunteers compare the breakwater drawings with observations from the shore. Those visits give the paper collection a useful conversation with the living harbor.",
    ],
    links: [
      ["night.local", "Read the breakwater observations after dark"],
      ["radio.local", "Listen to the archive's harbor frequency notes"],
      ["harbor.local", "Return to the current walking map"],
    ],
  },
  {
    address: "night.local",
    title: "After Dark on the Breakwater",
    paragraphs: [
      "After the last workshop closes, the breakwater becomes a place for listening. Water slips between the stones with a different rhythm on each side. Mira asks visitors to stand still before switching on a torch. The harbor has enough light for careful walking, and a brighter beam can erase the small details people came to notice.",
      "On a calm evening, bioluminescence sometimes appears in the wash beside the lowest stones. A brief blue spark follows a ripple and vanishes before anyone can point to it. The notebook records what disturbed the water, how long observers waited, and whether the moon was visible. Absence is recorded just as carefully as a sighting.",
      "Nobody climbs down to manufacture a better observation. The best comparison is made from the same safe railing on several evenings. At dawn, the bakery supplies warm bread to the volunteers heading home. An old observatory link remains in the notes, a reminder that a useful trail can contain a page that has gone missing.",
    ],
    links: [
      ["dawn.local", "Walk to the bakery before the first boat"],
      ["tides.local", "Check the daylight account of the old steps"],
      ["closed-observatory.local", "Try the missing observatory notebook"],
    ],
  },
  {
    address: "dawn.local",
    title: "Bread Before the First Boat",
    paragraphs: [
      "The bakery window opens before the first boat leaves Brindle. Elias likes this hour because the queue contains people finishing a shift and people beginning one. Their conversations overlap for a few minutes around the same warm shelf. A loaf becomes an excuse to compare two different versions of the harbor's night.",
      "The baker measures fermentation by the feel of the dough as well as the clock. Cool mornings change the waiting time, so the notebook keeps a temperature beside each batch. A recipe copied without those observations would sound precise while leaving out the part that helps another person succeed.",
      "Empty flour sacks travel to the workshop, where they protect repaired wooden parts from damp air. Yesterday's surplus bread goes to the market kitchen. These arrangements are ordinary enough to disappear from official accounts, yet they explain how the neighborhood works when deliveries are late and nobody has planned a special event.",
    ],
    links: [
      ["workshop.local", "Follow the flour sacks to the repair bench"],
      ["market.local", "Find the market kitchen"],
    ],
  },
  {
    address: "workshop.local",
    title: "The Repair Bench by the Canal",
    paragraphs: [
      "The canal workshop begins each repair with a description of the failure. A chair that wobbles after rain asks a different question from one with a cracked joint. Mira writes the owner's observations on a card before taking anything apart. The card keeps an elegant repair from solving the wrong problem.",
      "Visitors can watch a small hand plane remove a shaving thin enough to reveal the wood's changing grain. The work is slower near an old screw hole. A repair worth keeping leaves evidence that the next maker can understand, including the shape of a patch and the reason it was placed there.",
      "A repaired radio on the shelf connects the bench to the harbor's evening conversations. Its case is scratched, but its tuning marks are carefully renewed. The workshop keeps a link to a missing lantern catalog because several unusual fittings still depend on names printed there. A broken reference is not a reason to discard the surrounding notes.",
    ],
    links: [
      ["radio.local", "Tune in to an hour on the harbor frequency"],
      ["harbor.local", "Locate the bench on the walking map"],
      ["lantern-catalog.local", "Try the old lantern fitting catalog"],
    ],
  },
  {
    address: "radio.local",
    title: "An Hour on the Harbor Frequency",
    paragraphs: [
      "For one hour each evening, the neighborhood radio room gathers short accounts from around Brindle. A gardener describes a blocked drain, a boat crew reports a loose marker, and the archive asks whether anyone remembers a penciled name. The program works because each speaker supplies a place and time rather than a grand conclusion.",
      "Elias keeps a written log beside the receiver. When two accounts disagree, he reads both back and asks what each person could actually see. The log is a record of a conversation, not a verdict. A correction is added beside the original entry so tomorrow's listener can understand why the account changed.",
      "The closing announcement points people back to the walking map and the archive. It also repeats the address of a ferry notice that has not yet been recovered. Keeping that gap visible is more honest than inventing a timetable. The harbor remains connected through its questions as much as through the answers already written down.",
    ],
    links: [
      ["harbor.local", "Start another walk through Brindle"],
      ["archive.local", "Compare the written archive notes"],
      ["ferry.local", "Look again for the ferry notice"],
    ],
  },
] as const satisfies readonly SeedPageDefinition[];

const { Typed, Link, Search, History } = NavigationSource;

/** Minute offsets, person indices, page indices (or missing addresses), sources. */
const historyPlan: readonly (readonly [
  number,
  number,
  number | string,
  NavigationSource,
])[] = [
  [0, 2, 0, Typed],
  [1, 0, 0, Typed],
  [2, 2, 1, Link],
  [3, 1, 8, Typed],
  [4, 2, 2, Link],
  [5, 3, 6, Typed],
  [6, 2, 3, Link],
  [7, 0, 1, Link],
  [8, 2, 4, Link],
  [9, 1, 9, Link],
  [10, 2, 5, Link],
  [11, 3, 7, Link],
  [12, 2, 6, Link],
  [13, 0, "ferry.local", Typed],
  [14, 2, 7, Link],
  [16, 1, 5, Link],
  [18, 2, 8, Link],
  [20, 2, 9, Link],
  [22, 3, 2, Search],
  [24, 2, 0, Link],
  [26, 0, 2, Search],
  [28, 1, 6, Link],
  [30, 2, 1, Link],
  [32, 3, "lantern-catalog.local", Typed],
  [34, 0, 3, Link],
  [36, 2, 6, Search],
  [38, 1, 4, Search],
  [40, 3, 8, Typed],
  [42, 2, "closed-observatory.local", Link],
  [44, 0, 0, Link],
  [46, 1, 8, Link],
  [48, 3, 7, History],
  [50, 2, 9, Search],
  [52, 0, 4, Search],
  [54, 1, 6, Typed],
  [56, 3, 0, Typed],
  [58, 2, 7, History],
  [60, 0, 5, Link],
];

function fixedId(kind: string, number: number): Types.ObjectId {
  return new Types.ObjectId(
    `6500000000000000${kind}${number.toString(16).padStart(6, "0")}`,
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function pageHtml(page: SeedPageDefinition): string {
  const paragraphs = page.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
  const links = page.links
    .map(
      ([address, label]) =>
        `<li><a href="https://${escapeHtml(address)}" data-address="${escapeHtml(address)}">${escapeHtml(label)}</a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(page.title)}</title></head>
<body><main><h1>${escapeHtml(page.title)}</h1>
${paragraphs}
<nav aria-label="Related pages"><ul>
${links}
</ul></nav></main></body></html>`;
}

export interface SeedRecords {
  people: (Person & { _id: Types.ObjectId })[];
  sites: (Site & { _id: Types.ObjectId })[];
  visits: (Visit & { _id: Types.ObjectId })[];
}

/** Fresh objects on each call: no random IDs, clock reads, or mutable fixture dates. */
export function buildSeedRecords(): SeedRecords {
  const people = SEED_PEOPLE.map((person, index) => ({
    _id: fixedId("01", index + 1),
    ...person,
  }));
  const sites = SEED_PAGES.map((page, index) => ({
    _id: fixedId("02", index + 1),
    address: normalizeAddress(page.address),
    title: page.title,
    html: pageHtml(page),
    plainText: [
      page.title,
      ...page.paragraphs,
      ...page.links.map(([, label]) => label),
    ].join("\n\n"),
    author: people[index % 2]._id,
    publishedAt: new Date(Date.UTC(2026, 8, 14 + index, 7, 0, 0)),
  }));
  const sitesByAddress = new Map(sites.map((site) => [site.address, site]));
  const visits = historyPlan.map(([minute, person, target, source], index) => {
    const address =
      typeof target === "number"
        ? sites[target].address
        : normalizeAddress(target);
    const site = sitesByAddress.get(address);
    return {
      _id: fixedId("03", index + 1),
      person: people[person]._id,
      address,
      ...(site ? { site: site._id } : {}),
      source,
      status: site ? VisitStatus.Shown : VisitStatus.NotFound,
      visitedAt: new Date(Date.parse(SEED_HISTORY_START) + minute * 60_000),
    };
  });
  return { people, sites, visits };
}
