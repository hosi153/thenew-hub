/* ============ PASSWORD HASHING & VERIFICATION ============
   Extracted from the single main.js in stage 3 of
   docs/PERFORMANCE_REFACTORING_PLAN.md. Behavior is unchanged: new items
   use salted PBKDF2-SHA256 (210,000 iterations); legacy plain SHA-256
   items continue to verify correctly (pwVersion is absent/undefined for
   them, so matchesItemPassword falls back to hashPwLegacy). */

function bytesToHex(bytes){
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPwLegacy(pw){
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return bytesToHex(new Uint8Array(buf));
}
const PW_ITERATIONS = 210000;
async function derivePwHash(pw, saltHex, iterations=PW_ITERATIONS){
  const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map(v=>parseInt(v,16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt, iterations}, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
export async function createPasswordFields(pw){
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const pwSalt = bytesToHex(saltBytes);
  return { pwHash:await derivePwHash(pw, pwSalt), pwSalt, pwIterations:PW_ITERATIONS, pwVersion:2 };
}
async function matchesItemPassword(item, pw){
  if(item && item.pwVersion===2 && item.pwSalt){
    return await derivePwHash(pw, item.pwSalt, item.pwIterations || PW_ITERATIONS) === item.pwHash;
  }
  return await hashPwLegacy(pw) === (item && item.pwHash);
}

/* Master admin password (fallback for entries with no password of their own,
   and for overriding any entry's own password). Salted PBKDF2-SHA256 only. */
const ADMIN_PW_SALT = '905c02b4fd061bce585a9741581ec2b2';
const ADMIN_PW_HASH = 'b7b6863ceb8881dce3a6548214a7cac7dcf2401e36b8f2025f8389f9e3aa0f36';

/* Returns true if the entered password matches the item's stored hash, OR the admin master password */
export async function authenticateItem(item, pw){
  if(await derivePwHash(pw, ADMIN_PW_SALT) === ADMIN_PW_HASH) return true;
  return await matchesItemPassword(item, pw);
}
