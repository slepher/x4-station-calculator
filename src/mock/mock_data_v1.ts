export interface SavedModule {
  id: string;
  count: number;
}

export const mockStationData = {
  version: 1,
  activeId: '1',
  list: [
    {
      id: '1',
      name: 'Advanced Hull & Claytronics',
      description: '5 x Claytronics, 10 x Hull Parts, 8 x Microchips...',
      modules: [
        { id: 'prod_gen_claytronics_macro', count: 5 },
        { id: 'prod_gen_hullparts_macro', count: 10 },
        { id: 'prod_gen_antimattercells_macro', count: 1 },
        { id: 'prod_gen_microchips_macro', count: 8 },
        { id: 'prod_gen_quantumtubes_macro', count: 5 },
        { id: 'prod_gen_graphene_macro', count: 2 },
        { id: 'prod_gen_refinedmetals_macro', count: 6 },
        { id: 'prod_gen_energycells_macro', count: 3 }
      ],
      settings: {
        sunlight: 100,
        useHQ: false,
        manualWorkforce: 0,
        workforcePercent: 100,
        workforceAuto: true,
        considerWorkforceForAutoFill: false,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        minersEnabled: false,
        internalSupply: false
      },
      lastUpdated: 1738192666000
    },
    {
      id: '2',
      name: 'Starter Hull Production',
      description: '4 x Hull Parts, 2 x Refined Metals, 2 x Argon L Habitat...',
      modules: [
        { id: 'prod_gen_energycells_macro', count: 2 },
        { id: 'prod_gen_hullparts_macro', count: 4 },
        { id: 'prod_gen_refinedmetals_macro', count: 2 },
        { id: 'prod_gen_graphene_macro', count: 1 },
        { id: 'hab_arg_l_01_macro', count: 2 }
      ],
      settings: {
        sunlight: 100,
        useHQ: false,
        manualWorkforce: 0,
        workforcePercent: 100,
        workforceAuto: true,
        considerWorkforceForAutoFill: false,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        minersEnabled: false,
        internalSupply: false
      },
      lastUpdated: 1738192666000
    }
  ]
};