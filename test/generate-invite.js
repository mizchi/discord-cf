/**
 * Generate bot invite link
 */

import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = '1397525929093497013'; // Bot's application ID

// Permissions needed for voice
const PERMISSIONS = 
  0x400 |        // VIEW_CHANNEL
  0x100000 |     // CONNECT  
  0x200000 |     // SPEAK
  0x2000000 |    // USE_VAD (Voice Activity Detection)
  0x80;          // GUILD_VOICE_STATES (intent)

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=bot`;

console.log('Bot Invite Link:');
console.log(inviteUrl);
console.log('\nPermissions included:');
console.log('- VIEW_CHANNEL');
console.log('- CONNECT (to voice channels)');
console.log('- SPEAK');
console.log('- USE_VAD');
console.log('- Access to voice state events');
console.log('\n1. Open the link above in your browser');
console.log('2. Select the server where you want to add the bot');
console.log('3. Confirm the permissions');
console.log('4. Run the voice tests again');