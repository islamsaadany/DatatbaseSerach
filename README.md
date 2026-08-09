# Team Search

A simple, self-contained search app for looking up team members by **name** or **phone number**.

## Usage

Open `index.html` in any web browser. No build step or server required.

- Type in the search box to filter by name or phone.
- Use the **Add** form to add a new member (name + phone).
- Click the **trash icon** on a card to delete a member.
- Click **Call** to dial a member directly (on supported devices).

Added and deleted members are saved in your browser (localStorage), so
changes persist across reloads. Clearing browser data resets the list
back to the sample members.

## Team data

Members live in the `team` array inside `index.html`:

```js
const team = [
  { name: "Alice Johnson", phone: "+1 555 123 4567" },
  { name: "Bob Smith", phone: "+1 555 987 6543" }
];
```

Edit that array to add, remove, or update members.
