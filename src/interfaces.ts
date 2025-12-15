export interface IDBSecrets {
  username: string;
  password: string;
  engine: "postgres";
  host: string;
  proxy_url: string;
  port: 5432;
  dbInstanceIdentifier: string;
}

export interface IDBHealth {
  connected: boolean;
  connectionUsesProxy: boolean;
  logs?: {
    messages: string[];
    host?: string;
    timestamp: string;
    error?: string;
  };
}

export interface IGPSLocation {
  lat: number;
  lng: number;
  speed: string;
  temp: string;
  alt: string;
  bearing: string;
  bearing_raw: string;
  mode: number;
  time: number;
  type: string;
  status: string;
  redirect: string;
  count: string;
  tracking_mode_type_id: number;
}

export interface ISantaFlyoverResponse {
  lat: number | null;
  lng: number | null;
  speed: number | null;
  alt: number | null;
  bearing: number | null;
  mode: number | null;
  time: number | null;
  eventUpdate: IEventUpdate;
  interval: number;
  liftoff: number | undefined;
  instanceId?: string;
}

export interface ISponsor {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  website_url?: string;
  fb_url?: string;
  ig_url?: string;
  logo_s3_key?: string;
  logo_small_s3_key?: string;
  created_at: string;
  updated_at: string;
}

export interface ISponsorLogo {
  full: string | null;
  small: string | null;
  full_url: string | null;
  small_url: string | null;
}

export interface ISponsorLatestYearInfo {
  latest_year: number | null;
  amount_donated: number | null;
  active: boolean | null;
  anonymous: boolean | null;
  can_advertise: boolean | null;
}

export interface ISponsorCacheItem
  extends Omit<ISponsorLatestYearInfo, "amount_donated"> {
  //dont send amount donated
  id: number;
  name: string;
  website_url: string | null;
  fb_url: string | null;
  ig_url: string | null;
  logo: ISponsorLogo;
  linger: number;
  years_as_sponsor: number;
}

export interface ISponsorCachePayload {
  sponsors: ISponsorCacheItem[];
  refreshedAt: string;
}

export interface ISponsorYear {
  id: number;
  sponsor_id: number;
  event_year: number;
  amount_donated: number;
  active: boolean;
  can_advertise: boolean;
  anonymous: boolean;
  registered_at: string;
}

export interface IContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  created: number;
}

export interface IHtmlEmail {
  to: string;
  from: string;
  subject: string;
  file: string;
  var_old: string[];
  var_new: string[];
}

export interface IFund {
  id?: string;
  name?: string;
  percent: number;
  created?: number;
  [key: string]: any;
}

export interface IEventUpdate {
  id?: number;
  message: string;
  time?: string | null;
  created_at?: string | null;
}

export interface IEC2Launch {
  id?: number;
  instance_id: string;
  public_ip: string;
  private_ip: string;
  is_leader: boolean;
  launched_at?: string;
}

export interface ITrackiDevice {
  id: number;
  name: string;
  device_id: number;
  url_chunk: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ITrackiAPIResponse {
  deviceName: string;
  deviceId: number;
  geoLocation: {
    latitude: number;
    longitude: number;
    type: string;
    accuracyInMeter: number;
  };
  lastUpdated: number;
  batteryLevel: number;
}

export interface ITrackingMode {
  id: number;
  tracking_mode_type_id: number;
  is_active: number;
  created_at: string;
}

export interface ITrackingModeType {
  id: number;
  mode_name: string;
  description: string;
  interval: number;
}

export interface IAboutMe {
  amILeader: boolean;
  myInstanceId: string;
  publicIp: string;
  privateIp: string;
}

export interface IEventModeOverride {
  id?: number;
  mode: number;
  expires_at: string;
  created_at?: string;
}
export interface IFlightHistory {
  id?: number;
  year: number;
  lat: number;
  lng: number;
  time: number;
  seq: number;
}

export interface ISantaRouteCache {
  lat: number;
  lng: number;
  seq: number;
  time?: string;
}

export interface ILiftoff {
  id: number;
  liftoff_time: string | null;
}

export interface IDashboardConfigResponse {
  secrets: {
    protectedRoutePrefix: string;
    chrisTrackerAuth: string;
    secretSanta: string
  };
  appState: {
    currentTrackingMode: ITrackingMode & {
      mode_name: string;
    };
    secondaryTrackingDevice: ITrackiDevice;
    eventUpdate: IEventUpdate;
    fundsStatus: IFund;
  };
}
