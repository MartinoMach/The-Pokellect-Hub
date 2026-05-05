try {
  console.log("Starting to load Pokellect functions...");
  
  require("./functions/register");
  require("./functions/login");
  require("./functions/getProfile");
  require("./functions/updateProfile");
  require("./functions/addFranchise");
  require("./functions/getMetadata");
  require("./functions/addGlobalCard");
  require("./functions/importTcgapiCard");
  require("./functions/getGlobalCards");
  require("./functions/uploadCardImage");
  require("./functions/addToBinder");
  require("./functions/getMyBinder");
  require("./functions/removeFromBinder");
  require("./functions/searchTcgapi");
  require("./functions/searchUsers");
  require("./functions/manageFriends");
  require("./functions/getMessages");
  require("./functions/sendMessage");
  require("./functions/clearMessages");

  console.log("Successfully loaded all Pokellect functions!");
} catch (error) {
  console.error("FATAL ERROR DURING STARTUP:", error.message);
  console.error(error.stack);
  throw error; // Re-throw so Azure knows the startup actually failed!
}
