# Team Search

A simple, self-contained search app for looking up team members by **name** or **phone number**.

## Usage

Open `index.html` in any web browser. No build step or server required.

- Type in the search box to filter by name or phone.
- Click **Call** to dial a member directly (on supported devices).

## Team data

Members live in the `team` array inside `index.html`:

```js
const team = [
  { name: "Alice Johnson", phone: "+1 555 123 4567" },
  { name: "Bob Smith", phone: "+1 555 987 6543" }
];
```

Edit that array to add, remove, or update members.
