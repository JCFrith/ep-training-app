// Site assessment checklist structure — ported verbatim from the site-assessment app.
// Check indices (e.g. airspace-0) MUST stay aligned with coa-waiver-rules.json.

export type Check = {
  text: string;
  photo?: string;
  field?: string;
  options?: string[];
  contact?: boolean;
  tree?: boolean;
  autodate?: boolean;
};

export type Section = {
  id: string;
  num: string;
  title: string;
  checks: Check[];
  notes?: boolean;
};

export const LOGO = 'https://enhancedpatrol.com/wp-content/uploads/2024/08/enhanced-patrol-logo.png';

export const SECTIONS: Section[] = [
  { id: 'airspace', num: '1', title: 'Airspace & Regulatory', notes: true, checks: [
    { text: 'Airspace classification confirmed', options: ['Class G','Class E-SFC','Class D','Class C','Class B'] },
    { text: 'Distance to nearest airport/heliport documented', options: ['Greater than 3 NM','Less than 3 NM'] },
    { text: 'All airports, heliports, ag operations, and military installations within 3 NM identified' },
    { text: 'Notification letters prepared/sent for all facilities within 3 NM' },
    { text: 'TFRs reviewed -- none impacting operations' },
    { text: 'NOTAMs reviewed -- none affecting operations' },
    { text: 'LAANC restrictions reviewed (if applicable)' },
    { text: 'No restricted, prohibited, or special-use airspace conflicts' },
    { text: 'Known low-altitude helicopter activity evaluated', field: 'Activity observed or documented...' },
    { text: 'Frequency of TFR activity assessed -- not operationally disruptive' },
    { text: 'Site falls within waiver-authorized airspace and altitude limits' }
  ]},
  { id: 'property', num: '2', title: 'Property & Access Controls', notes: true, checks: [
    { text: 'Property boundaries confirmed (survey, plat, or client-provided)', photo: 'property_boundaries' },
    { text: 'Controlled access verified (gates, fencing, security)', photo: 'access_control' },
    { text: 'Signage plan for non-participant notification identified' },
    { text: 'Client POC for property access and notifications identified', contact: true },
    { text: 'Adjacent property exposure assessed', field: 'Describe exposure...' },
    { text: 'Public roads / sidewalks at perimeter identified and evaluated', field: 'Describe perimeter exposure...' }
  ]},
  { id: 'shielding', num: '3', title: 'Shielding / Containment Assessment', notes: true, checks: [
    { text: 'Potential shielding features identified', photo: 'shielding_features' },
    { text: 'Shielding heights measured or validated', field: 'Max height (ft)' },
    { text: 'Vertical containment validated' },
    { text: 'Lateral containment validated' },
    { text: 'All unshielded segments identified and documented' },
    { text: 'Unshielded segments within allowable limits OR VO requirement triggered' },
    { text: 'Emergency descent paths remain within containment' },
    { text: 'Dynamic shielding features flagged', field: 'Describe dynamic features...' },
    { text: 'RTH path stays within shielding' },
    { text: 'Shielded vs. non-shielded classification documented', options: ['Shielded','Non-Shielded','Mixed -- documented per segment'] }
  ]},
  { id: 'ground', num: '4', title: 'Ground Risk Assessment', notes: true, checks: [
    { text: 'Launch zone identified', photo: 'launch_zone' },
    { text: 'Launch/recovery areas pre-designated' },
    { text: 'Dock pad condition assessed', photo: 'dock_pad' },
    { text: 'Manual launch area surface and clearance assessed', photo: 'manual_launch' },
    { text: 'Line of sight from launch point to initial route segment confirmed' },
    { text: 'Landing zone safe and accessible' },
    { text: 'Emergency landing zone(s) identified within containment', photo: 'emergency_lz' },
    { text: 'Multiple recovery options identified if primary unavailable', photo: 'recovery_options' },
    { text: 'No overhead hazards at launch/land' },
    { text: 'Pedestrian flow patterns documented' },
    { text: 'Vehicle movement patterns documented' },
    { text: 'Parking lots, loading docks, active vehicle areas assessed', photo: 'vehicle_areas' },
    { text: 'Industrial equipment activity assessed' },
    { text: 'Construction activity evaluated' },
    { text: 'Ground slope, debris, drainage, FOD hazards evaluated' },
    { text: 'OOP/OOMV exposure zones identified', options: ['None','Low Risk','Medium Risk','High Risk'] },
    { text: 'Ground risk mitigations identified', field: 'Describe mitigations or N/A...' },
    { text: 'Seasonal variations considered' }
  ]},
  { id: 'rf', num: '5', title: 'RF / C2 Environment & Validation', notes: true, checks: [
    { text: 'Cat 5/6 hardwired ethernet assessable at site' },
    { text: 'LTE/5G coverage adequate at launch and along entire route' },
    { text: 'Starlink available or assessable' },
    { text: 'RF interference sources identified', photo: 'rf_interference' },
    { text: 'Metallic structures causing RF shadowing or multipath evaluated', photo: 'rf_shadowing' },
    { text: 'Urban canyon / multipath conditions assessed', photo: 'rf_urban' },
    { text: 'ROC/TOC communications tested' },
    { text: 'Authorized Ground Personnel communications tested' },
    { text: 'Dock network and sensor connectivity verified' }
  ]},
  { id: 'obstacle', num: '6', title: 'Obstacle & Terrain Survey', notes: true, checks: [
    { text: 'Obstacles mapped along intended route', photo: 'obstacles_route' },
    { text: 'Terrain variations documented', photo: 'terrain' },
    { text: 'Rooftop structures identified', photo: 'rooftop' },
    { text: 'Temporary structures checked', photo: 'temp_structures' },
    { text: 'Trees/vegetation evaluated for height and proximity', tree: true },
    { text: 'Wires/cables evaluated', photo: 'wires' },
    { text: 'Dynamic obstacles assessed', photo: 'dynamic_obs' },
    { text: 'Outdated geospatial/imagery data risk evaluated' }
  ]},
  { id: 'geofence', num: '7', title: 'Geofence & Containment Verification', notes: true, checks: [
    { text: 'Geofence covers entire operational area' },
    { text: 'Geofence matches property lines / controlled access perimeter + max altitude' },
    { text: 'Buffer for drift/contingencies included' },
    { text: 'RTH path avoids obstacles and stays within containment' },
    { text: 'RTH does not allow deviation outside operational volume' },
    { text: 'Restricted polygons placed over ground-risk hotspots' },
    { text: 'Polygon placement cross-checked against ground risk assessment' },
    { text: 'Conformance monitoring/alerts functional' },
    { text: 'Detailed annotated site image attached', photo: 'site_detail_image' }
  ]},
  { id: 'flightpath', num: '8', title: 'Flight Path Validation', notes: true, checks: [
    { text: 'Routes preplanned with waypoints' },
    { text: 'Entire route within validated containment' },
    { text: 'Planned altitude documented', field: 'Altitude (ft AGL)...' },
    { text: 'No exposure to unvalidated open airspace' },
    { text: 'Emergency descent and landing routes validated' },
    { text: 'No predicted conflict with ground activity or operational patterns' }
  ]},
  { id: 'notification', num: '9', title: 'Notification, Documentation & Supporting Documents', notes: true, checks: [
    { text: '3-NM facility notifications documented' },
    { text: 'Flight Risk Assessment completed and documented' },
    { text: 'Annotated site map screenshot attached' },
    { text: 'Copies of 3-NM notification letters attached' }
  ]},
  { id: 'risk', num: '10', title: 'Site Risk Determination', notes: true, checks: [
    { text: 'Overall site risk level assigned', options: ['Low','Medium','High'] },
    { text: 'Risk mitigations documented', field: 'Describe mitigations...' },
    { text: 'Unresolved risks flagged with required follow-up actions', field: 'Describe or N/A...' },
    { text: 'Biannual reassessment date scheduled', autodate: true },
    { text: 'Conditions requiring re-assessment identified' }
  ]},
  { id: 'approval', num: '11', title: 'Site Approval Decision', checks: [] }
];
