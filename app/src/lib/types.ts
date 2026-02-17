export interface Organisation {
  id: string
  name: string
  abn: string | null
  address: string | null
  phone: string | null
  email: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganisationUser {
  organisationId: string
  userId: string
  role: 'manager' | 'admin' | 'auditor'
  invitedBy: string | null
  invitedAt: string
  joinedAt: string | null
}

export interface Scheme {
  id: string
  organisationId: string
  schemeNumber: string
  schemeName: string
  schemeType: 'strata' | 'survey-strata' | 'community'
  streetAddress: string
  suburb: string
  state: string
  postcode: string
  abn: string | null
  acn: string | null
  registeredName: string | null
  financialYearEndMonth: number
  financialYearEndDay: number
  levyFrequency: 'monthly' | 'quarterly' | 'annual' | 'custom'
  levyDueDay: number
  totalLotEntitlement: number
  commonPropertyAreaSqm: number | null
  status: 'active' | 'inactive' | 'archived'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Lot {
  id: string
  schemeId: string
  lotNumber: string
  unitNumber: string | null
  streetAddress: string | null
  lotType: 'residential' | 'commercial' | 'parking' | 'storage' | 'other'
  unitEntitlement: number
  votingEntitlement: number | null
  floorAreaSqm: number | null
  balconyAreaSqm: number | null
  totalAreaSqm: number | null
  bedrooms: number | null
  bathrooms: number | null
  carBays: number | null
  status: 'active' | 'inactive' | 'sold'
  occupancyStatus: 'owner-occupied' | 'tenanted' | 'vacant' | 'unknown'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Owner {
  id: string
  title: string | null
  firstName: string
  lastName: string
  middleName: string | null
  preferredName: string | null
  email: string | null
  emailSecondary: string | null
  phoneMobile: string | null
  phoneHome: string | null
  phoneWork: string | null
  postalAddressLine1: string | null
  postalAddressLine2: string | null
  postalSuburb: string | null
  postalState: string | null
  postalPostcode: string | null
  postalCountry: string | null
  abn: string | null
  companyName: string | null
  correspondenceMethod: 'email' | 'postal' | 'both'
  correspondenceLanguage: string
  status: 'active' | 'inactive' | 'deceased'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LotOwnership {
  id: string
  lotId: string
  ownerId: string
  ownershipType: 'sole' | 'joint-tenants' | 'tenants-in-common'
  ownershipPercentage: number
  ownershipStartDate: string
  ownershipEndDate: string | null
  isPrimaryContact: boolean
  receiveLevyNotices: boolean
  receiveMeetingNotices: boolean
  receiveMaintenanceUpdates: boolean
  createdAt: string
  updatedAt: string
}

export interface CommitteeMember {
  id: string
  schemeId: string
  ownerId: string
  position: 'chair' | 'treasurer' | 'secretary' | 'member'
  electedAt: string
  termEndDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Tenant {
  id: string
  lotId: string
  firstName: string
  lastName: string
  email: string | null
  phoneMobile: string | null
  phoneWork: string | null
  leaseStartDate: string | null
  leaseEndDate: string | null
  leaseType: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  hasPets: boolean
  petDetails: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleRego: string | null
  vehicleColor: string | null
  status: 'current' | 'past' | 'pending'
  createdAt: string
  updatedAt: string
}
