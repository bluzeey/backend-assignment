import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

require('dotenv').config();
// Create PostgreSQL client
const Sequelize = require("sequelize-cockroachdb");
// Connect to CockroachDB through Sequelize.
const connectionString = process.env.DATABASE_URL
const sequelize = new Sequelize(connectionString, {
  dialectOptions: {
    application_name: "bitespeed-app"
  }
});
  
const contacts = sequelize.define("contacts", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phoneNumber: Sequelize.STRING,
    email: Sequelize.STRING,
    linkedId: Sequelize.INTEGER,
    linkPrecedence: Sequelize.STRING,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
    deletedAt: Sequelize.DATE,
  });


const app = express();
app.use(bodyParser.json());

app.post('/identify', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: 'Email or phoneNumber is required' });
    return;
  }

  try {
    const contact = await contacts.findOne({
      where: { email: email || null, phoneNumber: phoneNumber || null },
    });
    console.log(contact)
    if (!contact) {
      // Create a new primary contact
      const newContact = await contacts.create({
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: 'primary',
      });

      const contactData = {
        primaryContactId: newContact.id,
        emails: [newContact.email],
        phoneNumbers: [newContact.phoneNumber],
        secondaryContactIds: [],
      };

      res.status(200).json({ contact: contactData });
    } else {
      if (contact.linkPrecedence === 'primary') {
        // Primary contact found, check for secondary contacts
        const secondaryContacts = await contacts.findAll({
          where: { linkedId: contact.id },
        });

        const secondaryContactIds = secondaryContacts.map((secContact) => secContact.id);

        const contactData = {
          primaryContactId: contact.id,
          emails: [contact.email],
          phoneNumbers: [contact.phoneNumber],
          secondaryContactIds,
        };

        res.status(200).json({ contact: contactData });
      } else {
        // Secondary contact found
        const primaryContact = await contacts.findByPk(contact.linkedId);

        const contactData = {
          primaryContactId: primaryContact.id,
          emails: [primaryContact.email, contact.email],
          phoneNumbers: [primaryContact.phoneNumber, contact.phoneNumber],
          secondaryContactIds: [],
        };

        res.status(200).json({ contact: contactData });
      }
    }
  } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
