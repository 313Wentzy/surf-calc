const { createHmac } = require('crypto');

// Hardcoded secrets and endpoints (per request: avoid env vars)
const JWT_SECRET = 'dhebd73dbBBdwebdb3777Sssr4_DVVVghghrtaPLUH28';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1445175732102758450/8uptVY22OKzkUkRcXH4SebwrLGo5j7TYzztg7KfsVljatClcwy_C-3oJK32MdDOFqvjI';
const WORDPRESS_API_URL = 'https://dropmazter.com/wp-json/dpc/v1';
const API_KEY_PRODUCTS = 'e1c4d6a9-dd76-00082-a4e0-945bapb7061';

// In-memory store for duplicate checking (replace with DB in production)
const existingListings = new Map();

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Verify JWT token using HS256 and shared secret
 * @param {string} token
 * @returns {object|null}
 */
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createHmac('sha256', JWT_SECRET)
    .update(unsigned)
    .digest('base64url');

  if (expectedSignature !== signature) {
    console.error('[AUTH] JWT signature mismatch');
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Expiration check
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      console.error('[AUTH] JWT expired');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('[AUTH] Failed to decode JWT payload:', err.message);
    return null;
  }
}

/**
 * Send notification to Discord webhook
 * @param {object} data
 * @param {object} user
 * @param {string} status
 */
async function sendToDiscord(data, user, status = 'created') {
  const colors = {
    created: 0x28a745,
    duplicate: 0xffc107,
    error: 0xdc3545,
  };

  const titles = {
    created: '✅ New Listing Created',
    duplicate: '⚠️ Duplicate Listing Attempt',
    error: '❌ Listing Creation Failed',
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: titles[status] || titles.created,
            color: colors[status] || colors.created,
            timestamp: new Date().toISOString(),
            fields: [
              {
                name: 'User',
                value: `**${user.username || 'Unknown'}** (<@${user.sub || 'unknown'}>)`,
                inline: true,
              },
              {
                name: 'Title',
                value: data?.title || 'N/A',
                inline: true,
              },
              {
                name: 'Description',
                value: data?.short_description || 'N/A',
                inline: false,
              },
              {
                name: 'Display Coords',
                value: `\`${data?.display_lat}, ${data?.display_lng}\``,
                inline: true,
              },
              {
                name: 'Calc Points',
                value: `${data?.coords?.length || 0} point(s)`,
                inline: true,
              },
              {
                name: 'Calc Coords',
                value:
                  data?.coords?.length > 0
                    ? '```\n' + data.coords.join('\n') + '\n```'
                    : 'None',
                inline: false,
              },
            ],
            footer: {
              text: 'Dropmazter Marker Maker',
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[WEBHOOK] Failed to send Discord notification:', err.message);
  }
}

/**
 * Check if listing is duplicate (by title or display coords)
 * @param {string} title
 * @param {number} displayLat
 * @param {number} displayLng
 * @returns {boolean}
 */
function isDuplicate(title, displayLat, displayLng) {
  const titleKey = title.toLowerCase().trim();
  const coordKey = `${displayLat.toFixed(4)},${displayLng.toFixed(4)}`;

  if (existingListings.has(`title:${titleKey}`)) {
    return true;
  }

  for (const [key] of existingListings) {
    if (key.startsWith('coord:')) {
      const [, existingCoord] = key.split(':');
      const [existLat, existLng] = existingCoord.split(',').map(Number);

      if (
        Number.isFinite(existLat) &&
        Number.isFinite(existLng) &&
        Math.abs(existLat - displayLat) < 1 &&
        Math.abs(existLng - displayLng) < 1
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Store listing to prevent duplicates
 * @param {string} title
 * @param {number} displayLat
 * @param {number} displayLng
 */
function storeListing(title, displayLat, displayLng) {
  const titleKey = title.toLowerCase().trim();
  const coordKey = `${displayLat.toFixed(4)},${displayLng.toFixed(4)}`;

  existingListings.set(`title:${titleKey}`, true);
  existingListings.set(`coord:${coordKey}`, true);
}

/**
 * Parse calc coordinates from array of strings
 * @param {string[]} coords
 * @returns {Array}
 */
function parseCalcCoords(coords) {
  if (!coords || !Array.isArray(coords)) return [];

  return coords
    .map((coord) => {
      const parts = coord.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        return { lat: parts[0], lng: parts[1], height_offset: parts[2] };
      }
      if (parts.length === 2 && parts.every(Number.isFinite)) {
        return { lat: parts[0], lng: parts[1], height_offset: 0 };
      }
      return null;
    })
    .filter(Boolean);
}

function validateListing(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 3) {
    return 'Invalid title';
  }

  if (!body.short_description || typeof body.short_description !== 'string') {
    return 'Invalid description';
  }

  if (typeof body.display_lat !== 'number' || typeof body.display_lng !== 'number') {
    return 'Invalid display coordinates';
  }

  if (!body.coords || !Array.isArray(body.coords) || body.coords.length === 0) {
    return 'At least one calc coordinate is required';
  }

  return null;
}

async function handleCreateListing(headers, body) {
  console.log('[CREATE-LISTING] Received request');

  const authHeader = headers['authorization'];
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    console.log('[CREATE-LISTING] Missing or invalid Authorization header');
    await sendToDiscord(body, { sub: 'unknown', username: 'Unknown' }, 'error');
    return { status: 404, payload: { message: 'Unauthorized' } };
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    console.log('[CREATE-LISTING] Invalid JWT token');
    await sendToDiscord(body, { sub: 'unknown', username: 'Unknown' }, 'error');
    return { status: 404, payload: { message: 'Unauthorized' } };
  }

  const user = {
    sub: payload.sub,
    username: payload.username || 'Unknown',
  };

  console.log(`[CREATE-LISTING] Authenticated user: ${user.username} (${user.sub})`);

  const validationError = validateListing(body);
  if (validationError) {
    console.log(`[CREATE-LISTING] ${validationError}`);
    return { status: 404, payload: { message: validationError } };
  }

  const { title, short_description, display_lat, display_lng, coords } = body;

  if (isDuplicate(title, display_lat, display_lng)) {
    console.log(`[CREATE-LISTING] Duplicate detected: "${title}" or coords (${display_lat}, ${display_lng})`);
    await sendToDiscord(body, user, 'duplicate');
    return { status: 405, payload: { message: 'Duplicate listing: title or coordinates already exist' } };
  }

  const parsedCoords = parseCalcCoords(coords);
  console.log(`[CREATE-LISTING] Parsed ${parsedCoords.length} calc coordinates`);

  try {
    storeListing(title, display_lat, display_lng);

    // Placeholder for WordPress integration using API_KEY_PRODUCTS + WORDPRESS_API_URL
    // Keeping commented to mirror original behavior without external dependency

    await sendToDiscord(body, user, 'created');

    console.log(`[CREATE-LISTING] Successfully created listing: "${title}"`);

    return {
      status: 200,
      payload: {
        success: true,
        message: 'Listing created successfully',
        listing: {
          title,
          description: short_description,
          display_coords: { lat: display_lat, lng: display_lng },
          calc_points: parsedCoords.length,
          created_by: user.username,
          created_at: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error('[CREATE-LISTING] Error creating listing:', error.message);
    await sendToDiscord(body, user, 'error');
    return { status: 404, payload: { message: 'Failed to create listing' } };
  }
}

function handleHealth() {
  return {
    status: 200,
    payload: {
      success: true,
      service: 'create-listing',
      status: 'online',
      listings_count: existingListings.size / 2,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = {
  handleCreateListing,
  handleHealth,
};
