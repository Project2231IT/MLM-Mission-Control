# GoHighLevel API Notes — Mr. Crabs' Cheat Sheet

## Authentication
- Use **Private Integration Token** (not API v1 keys — those are deprecated)
- Token goes in: `Authorization: Bearer <TOKEN>`
- Must include header: `Version: 2021-07-28`
- Base URL: `https://services.leadconnectorhq.com`
- Private Integration Token is static (doesn't expire unless rotated)
- Created at: Settings → Integrations → Private Integrations

## Key Concepts
- **Location** = Sub-account in GHL. Each business can be a separate location
- **locationId** is REQUIRED for Private Integration tokens scoped to a sub-account
- Contacts are per-location (not global)
- Tags are strings — create them on the fly, no pre-registration needed

## Rate Limits
- 100 requests per 10 seconds per resource
- 200,000 requests per day per resource
- Headers: X-RateLimit-Remaining, X-RateLimit-Daily-Remaining

## Contact Endpoints

### Upsert Contact (SAFEST — use this)
POST /contacts/upsert
- Respects "Allow Duplicate Contact" settings at Location level
- If contact exists (by email or phone), updates it
- If not, creates new one
- WON'T create duplicates if settings are configured properly

### Create Contact
POST /contacts/
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "locationId": "LOCATION_ID",
  "tags": ["WiFi-Guest", "WiFi-New"],
  "source": "WiFi Portal",
  "customField": [
    { "key": "field_key", "field_value": "value" }
  ]
}
```

### Search/Find Contact
GET /contacts/search/duplicate?email=xxx&locationId=xxx
- Returns existing contact if found
- Use before create to avoid duplicates

### Update Contact
PUT /contacts/{contactId}
- Same body as create
- Tags are REPLACED, not merged — must send full tag list

### Add/Remove Tags
POST /contacts/{contactId}/tags
```json
{ "tags": ["tag1", "tag2"] }
```
DELETE /contacts/{contactId}/tags
```json
{ "tags": ["tag1"] }
```

## Important Gotchas
1. **Tags on update REPLACE, don't merge** — always fetch existing tags first, merge, then update
2. **Phone must be E.164 format** — +1XXXXXXXXXX (with country code)
3. **Custom fields** — must exist in GHL first before you can set them via API
4. **locationId** — REQUIRED when using Private Integration Token
5. **Upsert is safer than create** — handles duplicates automatically
6. **V1 API is dead** — don't use it, no support

## Our Integration Approach
1. Use Upsert endpoint (safest, no duplicate risk)
2. Tags for segmentation: WiFi-Guest, WiFi-New, WiFi-Returning, WiFi-VIP, SMS-Optin
3. Business-specific tags: WiFi-CityForum, WiFi-Dock17, etc.
4. Fire-and-forget: don't block portal registration on GHL response
5. Log errors but don't fail the portal flow

## P2231 GHL Setup
- Each business has its OWN sub-account/location in GHL
- Existing SMS workflows + sales rep commission tracking — DO NOT DISRUPT
- Our integration: upsert contacts with WiFi tags into the right sub-account
- GHL's existing automations take over from there

## What We Need From Jake
1. Private Integration Token FOR EACH sub-account (or one agency-level token)
2. Location IDs for each business:
   - TCF (The City Forum) → location_id: ???
   - D17 (Dock 17) → location_id: ???
   - ACME (ACME Athletics) → location_id: ???
   - AHW (ACME Health & Wellness) → location_id: ???
   - MLC (Miss Lucille's Café) → location_id: ???
   - MLM (Miss Lucille's Marketplace) → location_id: ???
3. Any existing tags we should NOT touch
4. Any existing custom fields we should populate
