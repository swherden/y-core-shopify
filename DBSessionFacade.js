class DBSessionFacade {
  #dbPool;

  constructor(dbPool) {
    this.#dbPool = dbPool;
  }

  async saveSessionForShop(sessionId, session) {
    try {
      const __session = JSON.stringify(session);
      //try to get expiration date
      const { expires } = session;
      let default_expires_at = new Date();
      default_expires_at.setDate(default_expires_at.getDate() + 1);
      const expires_at = expires ? new Date(expires) : default_expires_at;

      const SQL_SAVE_SESSION =
        "INSERT INTO sessions (session_id, expires_at, sessionInfo) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires_at=?, sessionInfo=?";

      const values = [sessionId, expires_at, __session, expires_at, __session];
      const saveSessionResult = await this.#dbPool.query(
        SQL_SAVE_SESSION,
        values
      );
      if (saveSessionResult && saveSessionResult.affectedRows > 0) return true;
      return false;
    } catch (err) {
      throw new Error(err);
    }
  }

  async getSessionForShop(sessionId) {
    try {
      var response = undefined;
      const SQL_LOAD_SESSION =
        "SELECT sessionInfo FROM sessions WHERE session_id=? and expires_at >= now()";
      const sessionData = await this.#dbPool.query(SQL_LOAD_SESSION, [
        sessionId,
      ]);
      if (sessionData && sessionData.length == 1) {
        response = sessionData[0].sessionInfo;
        if (response) response = JSON.parse(response);
      }
      return response;
    } catch (err) {
      throw new Error(err);
    }
  }

  async deleteSessionForShop(sessionId) {
    try {
      const SQL_DELETE_SESSION = "DELETE FROM sessions WHERE session_id =?";
      const deleteResponse = await this.#dbPool.query(SQL_DELETE_SESSION, [
        sessionId,
      ]);
      if (deleteResponse && deleteResponse.affectedRows > 0) return true;
      return false;
    } catch (err) {
      throw new Error(err);
    }
  }
}

module.exports = DBSessionFacade;
