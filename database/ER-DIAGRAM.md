# Database design: arunai_sacred_soils

12 tables, InnoDB, utf8mb4. The diagram below renders in GitHub, VS Code (Markdown Preview Mermaid Support extension) and mermaid.live.

```mermaid
erDiagram
    users ||--o| carts : "has one"
    users ||--o{ addresses : saves
    users ||--o{ orders : places
    users ||--o{ reviews : writes
    categories ||--o{ products : groups
    products ||--|| inventory : "stock in"
    products ||--o{ cart_items : "added as"
    products ||--o{ order_items : "sold as"
    products ||--o{ reviews : "reviewed in"
    carts ||--o{ cart_items : contains
    orders ||--|{ order_items : contains
    orders ||--|| payments : "paid by"

    users { int id PK
        string name
        string email UK
        string phone UK
        string password_hash
        enum role "customer or admin" }
    categories { int id PK
        string name UK
        string description
        string image_url }
    products { int id PK
        int category_id FK
        string name UK
        decimal price
        string unit
        string image_url
        bool is_available
        bool is_featured }
    inventory { int product_id PK, FK
        int quantity
        int low_stock_threshold }
    carts { int id PK
        int user_id FK, UK }
    cart_items { int id PK
        int cart_id FK
        int product_id FK
        int quantity }
    addresses { int id PK
        int user_id FK
        string line1
        string city
        string state
        string pin_code }
    orders { int id PK
        string order_number UK
        int user_id FK
        enum fulfilment
        decimal subtotal
        decimal delivery_charge
        decimal discount
        decimal total
        enum status }
    order_items { int id PK
        int order_id FK
        int product_id FK "nullable"
        string product_name
        decimal price
        int quantity
        decimal line_total }
    payments { int id PK
        int order_id FK, UK
        enum method
        enum status
        decimal amount }
    reviews { int id PK
        int product_id FK
        int user_id FK
        tinyint rating "1 to 5" }
    newsletter_subscribers { int id PK
        string email UK }
```

## Design decisions

* **Stock is in `inventory`, not `products`.** One row per product keeps the catalogue table clean and lets checkout lock only the stock rows.
* **`order_items` copies the product name, unit, image and price** at purchase time. Editing or deleting a product later never changes old orders (`product_id` becomes NULL on delete).
* **Money is `DECIMAL(10,2)`**, never floating point. A `CHECK` keeps prices above zero.
* **Cascades:** deleting a user removes their cart, cart items and addresses. Deleting a product removes its inventory row and cart entries. Orders are protected: a user with orders cannot be deleted, and a category with products cannot be deleted.
* **Unique constraints** stop duplicate emails, phone numbers, order numbers, product names, category names, one cart per user, one product line per cart, and one payment per order.
* **Passwords** are stored only as bcrypt hashes in `password_hash`. Card and UPI details are never stored (payments are demo only).
* **Indexes** cover every foreign key plus the columns the app filters and sorts on (`products.price`, `products.is_featured`, `orders.status`, `orders.created_at`).
* **No customers or admin rows are inserted by the schema.** Create the admin with `npm run seed:admin`.
