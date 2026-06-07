import type { Asset, CasingString, Formation, Pad, Well, Wellbore } from './types';

export interface AssetTreePad {
  pad: Pad;
  wells: Well[];
}

export interface AssetTreeNode {
  asset: Asset;
  pads: AssetTreePad[];
}

export interface WellboreDetail extends Wellbore {
  formations: Formation[];
  casingStrings: CasingString[];
}

export interface WellDetail {
  well: Well;
  wellbores: WellboreDetail[];
}
