#!/usr/bin/env node

import { hash } from "argon2";

async function generateHash() {
  // Get password from command line arguments
  const password = process.argv[2];
  
  if (!password) {
    console.error("Usage: node hash.js <password>");
    console.error("Example: node hash.js 'MySecurePassword123'");
    process.exit(1);
  }

  try {
    // Using EXACT same parameters as in your registerEmployerAccount function
    const passwordHash = await hash(password, {
      type: 2,           // Argon2id (recommended)
      memoryCost: 65536, // 64 MB (same as your code)
      timeCost: 3,       // 3 iterations (same as your code)
      parallelism: 1,    // 1 thread (same as your code)
    });
    
    console.log("\n✅ Argon2 Hash Generated Successfully!\n");
    console.log("Password:", password);
    console.log("Hash:", passwordHash);
    console.log("\n📋 Parameters used:");
    console.log("  - Type: Argon2id (type: 2)");
    console.log("  - Memory Cost: 65,536 KB (64 MB)");
    console.log("  - Time Cost: 3 iterations");
    console.log("  - Parallelism: 1 thread");
    console.log("\n💾 You can now use this hash in your database.");
    
  } catch (error) {
    console.error("❌ Error generating hash:", error.message);
    process.exit(1);
  }
}

generateHash();