import pool from "../src/db.js";

const getAgents = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email
             FROM users
             WHERE role = 'agent'
             ORDER BY name ASC`
        );

        res.status(200).json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch agents"
        });
    }
};

export { getAgents };