"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const app = (0, express_1.default)();
app.use(express_1.default.json());
require('dotenv').config();
// Create PostgreSQL client
const client = new pg_1.Client(process.env.DATABASE_URL);
(async () => {
    await client.connect();
    console.log('Connected to database');
    // Define the identify endpoint
    app.post('/identify', async (req, res) => {
        const { email, phoneNumber } = req.body;
        console.log(req.body)
        if (!email && !phoneNumber) {
            res.status(400).json({ error: 'Email or phoneNumber is required' });
            return;
        }
        try {
            const query = `
        SELECT * FROM contacts WHERE email = $1 OR phoneNumber = $2 LIMIT 1;
      `;
            const results = await client.query(query, [email, phoneNumber]);
            if (results.rowCount === 0) {
                // Create a new primary contact
                const insertQuery = `
          INSERT INTO contacts (email, phoneNumber, linkPrecedence) VALUES ($1, $2, 'primary') RETURNING id;
        `;
                const insertResult = await client.query(insertQuery, [email, phoneNumber]);
                const contact = {
                    primaryContactId: insertResult.rows[0].id,
                    emails: [email],
                    phoneNumbers: [phoneNumber],
                    secondaryContactIds: [],
                };
                res.status(200).json({ contact });
            }
            else {
                const contact = results.rows[0];
                if (contact.linkPrecedence === 'primary') {
                    // Primary contact found, check for secondary contacts
                    const secondaryQuery = `
            SELECT * FROM contacts WHERE linkedId = $1;
          `;
                    const secondaryResults = await client.query(secondaryQuery, [contact.id]);
                    const secondaryContactIds = secondaryResults.rows.map((secContact) => secContact.id);
                    contact.secondaryContactIds = secondaryContactIds;
                    res.status(200).json({ contact });
                }
                else {
                    // Secondary contact found
                    const primaryQuery = `
            SELECT * FROM contacts WHERE id = $1;
          `;
                    const primaryResult = await client.query(primaryQuery, [contact.linkedId]);
                    const primaryContact = primaryResult.rows[0];
                    contact.primaryContactId = primaryContact.id;
                    res.status(200).json({ contact });
                }
            }
        }
        catch (err) {
            console.error('Error querying the database:', err);
            res.status(500).json({ error: 'An error occurred' });
        }
    });
    // Start the server
    const port = 3001;
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
})();
