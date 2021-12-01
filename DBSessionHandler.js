import { Session } from "@shopify/shopify-api/dist/auth/session";
import DBSessionFacade from "./DBSessionFacade";

module.exports.storeSession = function (dbPool) {
  const sessionFacade = new DBSessionFacade(dbPool);
  return async (session) => {
    try {
      if (await sessionFacade.saveSessionForShop(session.id, session)) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  };
};

module.exports.loadSession = function (dbPool) {
  const sessionFacade = new DBSessionFacade(dbPool);
  return async (id) => {
    try {
      var data = await sessionFacade.getSessionForShop(id);
      if (data) {
        var newSession = new Session(data.id);
        newSession.shop = data.shop;
        newSession.state = data.state;
        newSession.scope = data.scope;
        newSession.isOnline = data.isOnline;
        newSession.accessToken = data.accessToken;
        newSession.expires = data.expires ? new Date(data.expires) : null;
        newSession.onlineAccessInfo = data.onlineAccessInfo; //My POST request already returns a javascript object, so no need to JSON.parse
        return newSession;
      } else {
        return undefined;
      }
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  };
};

module.exports.deleteSession = function (dbPool) {
  const sessionFacade = new DBSessionFacade(dbPool);
  return async (id) => {
    try {
      if (sessionFacade.deleteSessionForShop(id)) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      // throw errors, and handle them gracefully in your application
      throw new Error(err);
    }
  };
};
