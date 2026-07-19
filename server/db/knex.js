import knexLib from "knex";
import config from "./knexfile.js";

const db = knexLib(config);
export default db;
