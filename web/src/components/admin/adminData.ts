export type AdminListingPhoto = {
  label: string;
  path: string;
};

export type AdminListing = {
  id: string;
  name: string;
  address: string;
  accommodationType: string;
  exclusivity: string;
  monthlyRental: string;
  roomsAvailable: number;
  floorsLabel: string;
  occupancyLabel: string;
  curfew: string;
  utilitiesIncluded: boolean;
  billsNotIncluded: string;
  laundryArea: boolean;
  dryingArea: boolean;
  wifi: boolean;
  studyArea: boolean;
  parkingArea: boolean;
  petsAllowed: boolean;
  security: boolean;
  chargingStations: string;
  contactPerson: string;
  contactNumber: string;
  otherContactInformation: string;
  cellularSignals: string[];
  description: string;
  photos: AdminListingPhoto[];
  sourceRow: number;
};

export type DeletedListingRecord = {
  id: string;
  name: string;
  archivedAt: string;
  archivedBy: string;
  reason: string;
};

export const adminListings: AdminListing[] = [
  {
    id: "clarissa-modina-bh",
    name: "Clarissa Modina BH",
    address: "Pangasugan, Baybay City",
    accommodationType: "Boarding House",
    exclusivity: "All Female",
    monthlyRental: "1000-1999",
    roomsAvailable: 3,
    floorsLabel: "1 only",
    occupancyLabel: "1-4",
    curfew: "10pm",
    utilitiesIncluded: false,
    billsNotIncluded: "Water Electricity",
    laundryArea: false,
    dryingArea: false,
    wifi: false,
    studyArea: true,
    parkingArea: true,
    petsAllowed: true,
    security: false,
    chargingStations: "4 or more",
    contactPerson: "Clarissa Modina",
    contactNumber: "09677010737",
    otherContactInformation: "No alternate contact listed",
    cellularSignals: ["Smart/TnT", "Globe/TM"],
    description:
      "Compact all-female boarding house with study-friendly zoning, parking, and a straightforward rental setup near Pangasugan.",
    photos: [
      {
        label: "Cover",
        path: "listing-photos/demo/clarissa-modina-bh/exterior-front.jpg",
      },
      {
        label: "Room",
        path: "listing-photos/demo/clarissa-modina-bh/shared-room.jpg",
      },
      {
        label: "Kitchen",
        path: "listing-photos/demo/clarissa-modina-bh/common-kitchen.jpg",
      },
    ],
    sourceRow: 29,
  },
  {
    id: "gmb-dormitory",
    name: "GMB Dormitory",
    address: "Zone 2, Brgy. Guadalupe, Baybay City",
    accommodationType: "Dormitory",
    exclusivity: "Co-ed (Mixed)",
    monthlyRental: "500-999",
    roomsAvailable: 1,
    floorsLabel: "1 only",
    occupancyLabel: "5-8",
    curfew: "10pm",
    utilitiesIncluded: true,
    billsNotIncluded: "Included in rent",
    laundryArea: true,
    dryingArea: true,
    wifi: false,
    studyArea: false,
    parkingArea: true,
    petsAllowed: true,
    security: false,
    chargingStations: "2",
    contactPerson: "Beneranda Vivera",
    contactNumber: "No phone number in source file",
    otherContactInformation: "Beneranda Vivera",
    cellularSignals: ["Globe/TM"],
    description:
      "Budget-friendly mixed dormitory with included utilities, on-site laundry support, and a compact room inventory.",
    photos: [
      {
        label: "Cover",
        path: "listing-photos/demo/gmb-dormitory/exterior-front.jpg",
      },
      {
        label: "Dorm room",
        path: "listing-photos/demo/gmb-dormitory/dorm-room.jpg",
      },
      {
        label: "Bathroom",
        path: "listing-photos/demo/gmb-dormitory/bathroom.jpg",
      },
    ],
    sourceRow: 51,
  },
  {
    id: "jocelyn-poliquit-bh",
    name: "Jocelyn Poliquit Boarding House",
    address: "Zone 5, Guadalupe",
    accommodationType: "Boarding House",
    exclusivity: "Co-ed (Mixed)",
    monthlyRental: "3000 or more",
    roomsAvailable: 4,
    floorsLabel: "1 only",
    occupancyLabel: "5-8",
    curfew: "No curfew",
    utilitiesIncluded: false,
    billsNotIncluded: "Electricity Internet Connection/ WiFi Water",
    laundryArea: false,
    dryingArea: true,
    wifi: false,
    studyArea: true,
    parkingArea: true,
    petsAllowed: true,
    security: false,
    chargingStations: "4 or more",
    contactPerson: "Leni Layson",
    contactNumber: "No phone number in source file",
    otherContactInformation: "No alternate contact listed",
    cellularSignals: ["Smart/TnT"],
    description:
      "Higher-capacity mixed boarding option with no curfew, study area access, and space for listings that need fuller billing disclosure.",
    photos: [
      {
        label: "Cover",
        path: "listing-photos/demo/jocelyn-poliquit-bh/exterior-front.jpg",
      },
      {
        label: "Shared room",
        path: "listing-photos/demo/jocelyn-poliquit-bh/shared-room.jpg",
      },
      {
        label: "Study area",
        path: "listing-photos/demo/jocelyn-poliquit-bh/study-area.jpg",
      },
    ],
    sourceRow: 55,
  },
  {
    id: "roberta-albarico-bh",
    name: "Roberta Albarico BH",
    address: "Zone 3 Guadalupe",
    accommodationType: "Boarding House",
    exclusivity: "All Female",
    monthlyRental: "Less than 500",
    roomsAvailable: 2,
    floorsLabel: "1 only",
    occupancyLabel: "1-4",
    curfew: "10pm",
    utilitiesIncluded: false,
    billsNotIncluded: "Water Electricity",
    laundryArea: true,
    dryingArea: true,
    wifi: false,
    studyArea: true,
    parkingArea: true,
    petsAllowed: false,
    security: false,
    chargingStations: "3",
    contactPerson: "Roberta Albarico",
    contactNumber: "09693308908",
    otherContactInformation: "No alternate contact listed",
    cellularSignals: ["Smart/TnT", "Globe/TM"],
    description:
      "Very low-cost all-female boarding house with built-in room comfort rooms, study support, and a simple one-floor layout.",
    photos: [
      {
        label: "Cover",
        path: "listing-photos/demo/roberta-albarico-bh/exterior-front.jpg",
      },
      {
        label: "Interior",
        path: "listing-photos/demo/roberta-albarico-bh/room-interior.jpg",
      },
      {
        label: "Kitchen",
        path: "listing-photos/demo/roberta-albarico-bh/common-kitchen.jpg",
      },
    ],
    sourceRow: 104,
  },
  {
    id: "venegas",
    name: "Venegas",
    address: "Pangasugan",
    accommodationType: "Boarding House",
    exclusivity: "Co-ed (Mixed)",
    monthlyRental: "1000-1999",
    roomsAvailable: 2,
    floorsLabel: "1 only",
    occupancyLabel: "5-8",
    curfew: "10pm",
    utilitiesIncluded: false,
    billsNotIncluded: "Water",
    laundryArea: true,
    dryingArea: true,
    wifi: true,
    studyArea: true,
    parkingArea: true,
    petsAllowed: true,
    security: false,
    chargingStations: "4 or more",
    contactPerson: "Marelene Maningo",
    contactNumber: "09758777583",
    otherContactInformation: "No alternate contact listed",
    cellularSignals: ["Smart/TnT", "Globe/TM"],
    description:
      "Mixed boarding house sample with wifi, flexible capacity, and complete room-side bathrooms suited for dashboard testing.",
    photos: [
      {
        label: "Cover",
        path: "listing-photos/demo/venegas/exterior-front.jpg",
      },
      {
        label: "Room",
        path: "listing-photos/demo/venegas/shared-room.jpg",
      },
      {
        label: "Laundry",
        path: "listing-photos/demo/venegas/laundry-area.jpg",
      },
    ],
    sourceRow: 118,
  },
];

export const deletedListings: DeletedListingRecord[] = [
  {
    id: "archive-001",
    name: "Aehyan Dela Cruz BH",
    archivedAt: "March 28, 2026",
    archivedBy: "Admin account",
    reason: "Duplicate submission consolidated into the main active listing set.",
  },
  {
    id: "archive-002",
    name: "Alejandro Poliquit Dormitory",
    archivedAt: "March 29, 2026",
    archivedBy: "Admin account",
    reason: "Owner requested temporary removal while room details are being updated.",
  },
];