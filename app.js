// Main Orchestrator - Restaurant Management System
// Binds all feature modules together.

(function() {
  const AppOrchestrator = {
    // Global simulated states
    activeTab: 'billing',
    currentRole: 'admin', // admin, manager, cashier, kitchen
    kotQueue: [
      { id: 'kot-1', table: 'Table 2', time: '10 mins ago', items: [{ name: 'Margherita Pizza (Large)', qty: 2 }], status: 'cooking' },
      { id: 'kot-2', table: 'Table 5', time: '5 mins ago', items: [{ name: 'Double Cheese Burger', qty: 1 }], status: 'pending' }
    ],

    init: function() {
      // 1. Switch View Router Hook
      this.bindTabNavigation();
      
      // 2. Setup Role Switcher (RBAC)
      this.bindRoleSwitcher();
      
      // 3. Initialize Features Mock Data
      if (window.RMSBilling) window.RMSBilling.init();
      if (window.RMSInventory) window.RMSInventory.updateInventoryUI();
      if (window.RMSDelivery) window.RMSDelivery.updateDeliveryUI();
      if (window.RMSCRM) window.RMSCRM.updateCRMUI();
      if (window.RMSStaff) window.RMSStaff.updateStaffUI();
      
      // 4. Render POS Interface Elements
      this.renderPOSMenu('all');
      this.renderPOSTablesDropdown();
      
      // 5. Draw Analytics Charts (programmatic SVGs)
      this.renderAnalyticsCharts();

      // 6. Bind Events
      this.bindCalculatorSliders();
      this.bindPOSCartEvents();
      this.bindSystemEventHooks();

      // 7. Load default Weather Recommendations
      this.renderAIWeatherSuggestions('Sunny');
      
      // 8. Load forms and data defaults
      this.setupInventoryFormDropdowns();
      this.setupShiftPlannerDropdowns();

      // Write initial login log
      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('System Boot', 'Restaurant Management System POS terminal initialised successfully.');
      }
    },

    // View Routing Toggles
    switchToPortal: function() {
      document.getElementById('marketing-page').style.display = 'none';
      document.getElementById('portal-page').style.display = 'block';
      this.activeTab = 'billing';
      this.switchPortalTab('billing');
      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('Portal Router', 'User launched POS dashboard portal.');
      }
      // Re-trigger charting rendering to ensure SVG calculations match layouts
      this.renderAnalyticsCharts();
    },

    switchToMarketing: function() {
      document.getElementById('portal-page').style.display = 'none';
      document.getElementById('marketing-page').style.display = 'block';
      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('Portal Router', 'User logged out of POS dashboard.');
      }
    },

    bindTabNavigation: function() {
      const items = document.querySelectorAll('.portal-nav-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const tabName = item.getAttribute('data-tab');
          this.switchPortalTab(tabName);
        });
      });
    },

    switchPortalTab: function(tabName) {
      // Check permissions
      if (!this.checkRolePermissions(tabName)) {
        alert(`Access Denied: Your current role (${this.currentRole.toUpperCase()}) does not have permission to view ${tabName.toUpperCase()} features.`);
        return;
      }

      this.activeTab = tabName;
      
      // Update sidebar nav UI
      const items = document.querySelectorAll('.portal-nav-item');
      items.forEach(it => {
        if (it.getAttribute('data-tab') === tabName) {
          it.classList.add('active');
        } else {
          it.classList.remove('active');
        }
      });

      // Update View Title
      const titles = {
        'billing': 'POS Billing & Orders Checkout',
        'kds': 'Kitchen Order Tickets (KDS)',
        'inventory': 'Inventory & Recipe Costing',
        'delivery': 'Omnichannel Delivery Tracking',
        'crm': 'CRM Loyalty Directory',
        'analytics': 'Analytics & Profit Metrics',
        'staff': 'Staff Shifts & Onboarding',
        'marketing': 'Coupons & WhatsApp Campaigns',
        'cloud': 'Cloud Sync & Store Branch Config',
        'security': 'Compliance & Console Audit Logs'
      };
      document.getElementById('portal-view-title').innerText = titles[tabName] || 'Restaurant Management System';

      // Update active view content pane
      const contentPanes = document.querySelectorAll('.portal-tab-content');
      contentPanes.forEach(pane => {
        pane.classList.remove('active');
      });

      const activePane = document.getElementById(`view-${tabName}`);
      if (activePane) activePane.classList.add('active');

      // Refresh graph scales on tab active
      if (tabName === 'analytics') {
        this.renderAnalyticsCharts();
      }
      
      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('Portal Router', `Switched active dashboard view to: ${tabName.toUpperCase()}`);
      }
    },

    // Role Switch (RBAC) Permissions Checked
    bindRoleSwitcher: function() {
      const selector = document.getElementById('role-selector');
      selector.value = this.currentRole;
      
      selector.addEventListener('change', (e) => {
        const selected = e.target.value;
        this.currentRole = selected;
        window.RMSCurrentRole = selected;
        
        if (window.RMSSecurity) {
          window.RMSSecurity.addAuditLog('System Security', `User session permission role changed to: ${selected.toUpperCase()}`);
        }

        // Auto-redirect if role loses access to current active tab
        if (!this.checkRolePermissions(this.activeTab)) {
          if (selected === 'kitchen') {
            this.switchPortalTab('kds');
          } else if (selected === 'cashier') {
            this.switchPortalTab('billing');
          } else {
            this.switchPortalTab('billing');
          }
        }
      });
    },

    checkRolePermissions: function(tabName) {
      if (this.currentRole === 'admin') return true;
      if (this.currentRole === 'manager') {
        // managers can access everything except core developer console audit logs
        return tabName !== 'security';
      }
      if (this.currentRole === 'cashier') {
        // Cashiers only access Billing and Delivery tracking
        return ['billing', 'delivery'].includes(tabName);
      }
      if (this.currentRole === 'kitchen') {
        // Kitchen staff only access KDS tickets
        return ['kds'].includes(tabName);
      }
      return false;
    },

    // ROI Calculator
    bindCalculatorSliders: function() {
      const slideOrders = document.getElementById('slide-orders');
      const slideAov = document.getElementById('slide-aov');
      const lblOrders = document.getElementById('lbl-orders');
      const lblAov = document.getElementById('lbl-aov');
      const valSavings = document.getElementById('calc-savings-val');

      const recalculate = () => {
        const orders = parseInt(slideOrders.value);
        const aov = parseInt(slideAov.value);
        
        lblOrders.innerText = orders;
        lblAov.innerText = aov;

        // Formula: Orders * AOV * 30 days * 20% commission saved
        const monthlySavings = Math.round(orders * aov * 30 * 0.20);
        valSavings.innerText = `₹${monthlySavings.toLocaleString('en-IN')}`;
      };

      if (slideOrders && slideAov) {
        slideOrders.addEventListener('input', recalculate);
        slideAov.addEventListener('input', recalculate);
      }
    },

    // POS Menu Items Grid Rendering
    renderPOSMenu: function(category = 'all') {
      const container = document.getElementById('pos-menu-grid');
      if (!container || !window.RMSBilling) return;

      let items = window.RMSBilling.menuItems;
      if (category !== 'all') {
        items = items.filter(item => item.category === category);
      }

      container.innerHTML = items.map(item => `
        <div class="pos-item-card" onclick="window.RMSApp.openModifiersModal('${item.id}')">
          <div>
            <div class="pos-item-icon">${item.image}</div>
            <div class="pos-item-name">${item.name}</div>
            <div class="pos-item-desc">${item.desc}</div>
          </div>
          <div class="pos-item-price">₹${item.price}</div>
        </div>
      `).join('');

      // Setup Category Buttons Actions
      const catBtns = document.querySelectorAll('.pos-category-btn');
      catBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          catBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.getAttribute('data-category');
          this.renderPOSMenu(cat);
        });
      });
    },

    // Render Table dropdowns
    renderPOSTablesDropdown: function() {
      const select = document.getElementById('cart-table-selector');
      if (!select || !window.RMSBilling) return;

      select.innerHTML = window.RMSBilling.tables.map(t => `
        <option value="${t.id}">${t.name} (Cap: ${t.capacity})</option>
      `).join('');
    },

    // Modifiers Selection Dialog Box
    openModifiersModal: function(itemId) {
      if (!window.RMSBilling) return;
      const item = window.RMSBilling.menuItems.find(i => i.id === itemId);
      if (!item) return;

      document.getElementById('modifier-item-id').value = item.id;
      document.getElementById('modifier-item-title').innerText = item.name;

      // Render Sizes Radios
      const sizesBox = document.getElementById('modifier-sizes-container');
      sizesBox.innerHTML = item.modifiers.sizes.map((s, idx) => `
        <input type="radio" name="mod-size-val" id="sz-${s.name}" value="${s.name}" ${idx === 0 ? 'checked' : ''}>
        <label for="sz-${s.name}" class="modifier-radio-label">${s.name} (+₹${s.price})</label>
      `).join('');

      // Render Extras Checkboxes
      const extrasBox = document.getElementById('modifier-extras-container');
      if (item.modifiers.extras.length > 0) {
        extrasBox.innerHTML = item.modifiers.extras.map(e => `
          <input type="checkbox" name="mod-extra-val" id="ex-${e.name}" value="${e.name}">
          <label for="ex-${e.name}" class="modifier-checkbox-label">${e.name} (+₹${e.price})</label>
        `).join('');
      } else {
        extrasBox.innerHTML = '<div style="font-size:0.8rem; color:#94a3b8;">No extras modifiers for this item.</div>';
      }

      document.getElementById('pos-modifiers-modal').style.display = 'flex';
    },

    closeModifiersModal: function() {
      document.getElementById('pos-modifiers-modal').style.display = 'none';
    },

    confirmModifiersSelection: function() {
      const itemId = document.getElementById('modifier-item-id').value;
      const sizeRadio = document.querySelector('input[name="mod-size-val"]:checked');
      const sizeVal = sizeRadio ? sizeRadio.value : '';

      const extrasChecks = document.querySelectorAll('input[name="mod-extra-val"]:checked');
      const selectedExtras = Array.from(extrasChecks).map(c => c.value);

      if (window.RMSBilling) {
        window.RMSBilling.addToCart(itemId, sizeVal, selectedExtras);
      }
      this.closeModifiersModal();
    },

    // Cart Events Hooks
    bindPOSCartEvents: function() {
      // Coupon inputs
      const orderModeSel = document.getElementById('cart-order-mode');
      if (orderModeSel && window.RMSBilling) {
        orderModeSel.addEventListener('change', (e) => {
          window.RMSBilling.selectedOrderMode = e.target.value;
        });
      }

      const tableSel = document.getElementById('cart-table-selector');
      if (tableSel && window.RMSBilling) {
        tableSel.addEventListener('change', (e) => {
          window.RMSBilling.selectedTableId = parseInt(e.target.value);
        });
      }

      // pay settle click
      const payBtn = document.getElementById('pay-checkout-action-btn');
      if (payBtn) {
        payBtn.addEventListener('click', () => {
          if (!window.RMSBilling || window.RMSBilling.currentCart.length === 0) {
            alert('Cannot proceed: Cart is empty.');
            return;
          }
          this.openCheckoutModal();
        });
      }
    },

    applyPromoCode: function() {
      const code = document.getElementById('coupon-code-val').value;
      if (!code) return;

      if (window.RMSBilling) {
        const result = window.RMSBilling.applyCouponCode(code);
        if (result.success) {
          document.getElementById('coupon-code-val').value = '';
        } else {
          alert(result.message);
        }
      }
    },

    removePromoCode: function() {
      if (window.RMSBilling) {
        window.RMSBilling.removeCoupon();
      }
    },

    // Settlement Pay Modal
    openCheckoutModal: function() {
      if (!window.RMSBilling) return;
      
      const totalBill = window.RMSBilling.getCartTotal();
      document.getElementById('checkout-split-mode').value = 'none';
      document.getElementById('split-price-indicator').style.display = 'none';

      document.getElementById('pos-checkout-modal').style.display = 'flex';
    },

    closeCheckoutModal: function() {
      document.getElementById('pos-checkout-modal').style.display = 'none';
    },

    handleSplitPaymentToggle: function() {
      if (!window.RMSBilling) return;
      const select = document.getElementById('checkout-split-mode').value;
      const indicator = document.getElementById('split-price-indicator');

      if (select === 'none') {
        indicator.style.display = 'none';
      } else {
        const divisor = parseInt(select);
        const splitVal = Math.round(window.RMSBilling.getCartTotal() / divisor);
        document.getElementById('split-value-lbl').innerText = `₹${splitVal}`;
        indicator.style.display = 'block';
      }
    },

    completeCheckoutSettlement: function() {
      if (!window.RMSBilling) return;

      const phone = document.getElementById('checkout-cust-phone').value;
      const method = document.querySelector('input[name="payment-method"]:checked').value;
      const splitMode = document.getElementById('checkout-split-mode').value;
      const totalAmount = window.RMSBilling.getCartTotal();

      // CRM points addition
      if (phone && window.RMSCRM) {
        window.RMSCRM.recordVisit(phone, totalAmount);
      }

      // Deduct ingredients stock levels dynamically
      if (window.RMSInventory) {
        window.RMSBilling.currentCart.forEach(cartItem => {
          window.RMSInventory.deductStockForMenuItem(cartItem.id, cartItem.quantity);
        });
      }

      // Create Kitchen Ticket (KOT)
      const kotItems = window.RMSBilling.currentCart.map(item => ({
        name: `${item.name} (${item.selectedSize})`,
        qty: item.quantity
      }));
      const tableObj = window.RMSBilling.tables.find(t => t.id === window.RMSBilling.selectedTableId);
      const tableName = tableObj ? tableObj.name : `Table ${window.RMSBilling.selectedTableId}`;

      const newKOT = {
        id: 'kot-' + Date.now().toString().substr(-4),
        table: tableName,
        time: 'Just now',
        items: kotItems,
        status: 'pending'
      };
      
      this.kotQueue.unshift(newKOT);
      this.renderKDS();

      // Write Invoice receipt template
      this.renderInvoiceReceipt(phone, method, splitMode);

      // Log Security audits
      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('POS Billing', `Checkout completed: Out-bill Table ${window.RMSBilling.selectedTableId}. Settled ₹${totalAmount} via ${method}. KOT issued.`);
      }

      // Reset cart state
      window.RMSBilling.currentCart = [];
      window.RMSBilling.activeCoupon = null;
      window.RMSBilling.updateCartUI();

      this.closeCheckoutModal();
      document.getElementById('pos-invoice-modal').style.display = 'flex';
    },

    // Render text bill receipt FSSAI invoice
    renderInvoiceReceipt: function(phone, paymentMethod, splitMode) {
      if (!window.RMSBilling || !window.RMSSecurity) return;

      const cart = window.RMSBilling.currentCart;
      const subtotal = window.RMSBilling.getCartSubtotal();
      const tax = window.RMSBilling.getTaxAmount();
      const discount = window.RMSBilling.getDiscountAmount();
      const total = window.RMSBilling.getCartTotal();
      const fssai = window.RMSSecurity.gstConfig.fssaiLicense;

      let billText = `      DOWNTOWN BISTRO CAFE\n`;
      billText += `   FSSAI Lic No: ${fssai}\n`;
      billText += `------------------------------------\n`;
      billText += `Date: ${new Date().toLocaleString()}\n`;
      billText += `Settlement: ${paymentMethod} | Split: ${splitMode === 'none' ? 'No' : splitMode + '-way'}\n`;
      billText += `Customer: ${phone}\n`;
      billText += `------------------------------------\n`;
      
      cart.forEach(item => {
        billText += `${item.quantity}x ${item.name.padEnd(20)} ₹${item.unitPrice * item.quantity}\n`;
        if (item.extras.length > 0) {
          billText += `   + Extras: ${item.extras.map(e => e.name).join(', ')}\n`;
        }
      });
      
      billText += `------------------------------------\n`;
      billText += `Subtotal:                      ₹${subtotal}\n`;
      if (discount > 0) {
        billText += `Discount:                     -₹${discount}\n`;
      }
      billText += `CGST (9.0%):                   ₹${Math.round(tax/2)}\n`;
      billText += `SGST (9.0%):                   ₹${Math.round(tax/2)}\n`;
      billText += `------------------------------------\n`;
      billText += `GRAND TOTAL:                  ₹${total}\n`;
      billText += `------------------------------------\n`;
      billText += `   THANK YOU! VISIT AGAIN.\n`;

      document.getElementById('invoice-text-receipt').innerText = billText;
    },

    closeInvoiceModal: function() {
      document.getElementById('pos-invoice-modal').style.display = 'none';
    },

    downloadReceiptMock: function() {
      alert('Mock PDF download initialised. PDF generated on direct filesystem download stream.');
    },

    // KDS tickets rendering
    renderKDS: function() {
      const container = document.getElementById('kds-tickets-grid');
      if (!container) return;

      if (this.kotQueue.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#94a3b8; width:100%; grid-column:span 3; padding:40px;">No active kitchen orders currently. Ready for dispatch!</div>';
        return;
      }

      container.innerHTML = this.kotQueue.map((kot, idx) => {
        let actionBtn = '';
        if (kot.status === 'pending') {
          actionBtn = `<button class="btn-primary" style="width:100%; font-size:0.75rem; border-radius:4px; padding:6px;" onclick="window.RMSApp.updateKOTStatus('${kot.id}', 'cooking')"><i class="fa-solid fa-fire"></i> Start Cooking</button>`;
        } else if (kot.status === 'cooking') {
          actionBtn = `<button class="btn-accent" style="width:100%; font-size:0.75rem; border-radius:4px; padding:6px; background:#10b981;" onclick="window.RMSApp.updateKOTStatus('${kot.id}', 'ready')"><i class="fa-solid fa-circle-check"></i> Mark Ready</button>`;
        } else {
          actionBtn = `<div style="text-align:center; color:#10b981; font-weight:700; font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> Dispatched/Ready</div>`;
        }

        return `
          <div class="table-card" style="background:white; text-align:left; border-color:#cbd5e1; display:flex; flex-direction:column; justify-content:space-between; height:180px;">
            <div>
              <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #cbd5e1; padding-bottom:5px; margin-bottom:8px;">
                <span style="font-weight:700; color:#0f172a;">${kot.table}</span>
                <span style="font-size:0.7rem; color:#94a3b8;">${kot.time}</span>
              </div>
              <div style="font-size:0.8rem; color:#334155; max-height:80px; overflow-y:auto; margin-bottom:10px;">
                ${kot.items.map(i => `<div>${i.qty}x ${i.name}</div>`).join('')}
              </div>
            </div>
            <div>
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');
    },

    updateKOTStatus: function(kotId, newStatus) {
      const kot = this.kotQueue.find(k => k.id === kotId);
      if (kot) {
        kot.status = newStatus;
        if (window.RMSSecurity) {
          window.RMSSecurity.addAuditLog('KDS Monitor', `KOT Ticket ${kotId} updated status to: ${newStatus.toUpperCase()}.`);
        }
        this.renderKDS();
      }
    },

    // AI Weather Recommendations pills bindings
    renderAIWeatherSuggestions: function(weatherName) {
      if (!window.RMSAdvanced) return;
      const suggestions = window.RMSAdvanced.getWeatherSuggestions(weatherName);
      
      const container = document.getElementById('ai-recommendations-list');
      if (!container) return;

      container.innerHTML = suggestions.map(item => `
        <div class="ai-pill-item" onclick="window.RMSApp.addAIPillToCart('${item.id}')">
          <span>${item.image}</span>
          <span>Add ${item.name} (₹${item.price})</span>
        </div>
      `).join('');
    },

    addAIPillToCart: function(itemId) {
      if (window.RMSBilling) {
        window.RMSBilling.addToCart(itemId);
      }
    },

    // Interactive SVG Charts in Analytics view
    renderAnalyticsCharts: function() {
      if (window.RMSAnalytics) {
        window.RMSAnalytics.renderSalesLineChart('sales-line-chart-container');
        window.RMSAnalytics.renderPeakHoursBarChart('peak-hours-bar-chart-container');
        
        // Render Top items profitability matrix
        const tableBody = document.getElementById('analytics-top-items-body');
        if (tableBody) {
          tableBody.innerHTML = window.RMSAnalytics.topItems.map(item => {
            const recipeCost = window.RMSInventory ? window.RMSInventory.getRecipeCost(item.id || 'm1') : 80;
            const salePrice = item.id ? (window.RMSBilling.menuItems.find(i => i.id === item.id).price) : 299;
            const marginPercent = Math.round(((salePrice - recipeCost) / salePrice) * 100);

            return `
              <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.sold} Pcs</td>
                <td>₹${item.revenue.toLocaleString()}</td>
                <td><span class="tier-badge Gold" style="background:#f0fdf4; color:#166534; border-color:#bbf7d0;">${marginPercent}% Profit Margin</span></td>
              </tr>
            `;
          }).join('');
        }
      }
    },

    // Connect custom event callbacks
    bindSystemEventHooks: function() {
      // Cart Update listener
      window.addEventListener('rms-cart-updated', (e) => {
        const detail = e.detail;
        
        // Redraw cart counts
        document.getElementById('active-cart-items-count').innerText = `${detail.cart.length} Items`;
        
        // Redraw cart items HTML
        const container = document.getElementById('cart-items-container');
        if (detail.cart.length === 0) {
          container.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:40px;">Cart is empty. Tap items to build invoice.</div>';
        } else {
          container.innerHTML = detail.cart.map(item => `
            <div class="cart-item">
              <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-meta">${item.selectedSize}${item.extras.length > 0 ? ' + ' + item.extras.map(e => e.name).join(', ') : ''}</div>
              </div>
              <div class="cart-item-qty">
                <button class="qty-btn" onclick="window.RMSBilling.updateCartItemQuantity('${item.cartItemId}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="window.RMSBilling.updateCartItemQuantity('${item.cartItemId}', 1)">+</button>
              </div>
              <div class="cart-item-price-col">₹${item.unitPrice * item.quantity}</div>
            </div>
          `).join('');
        }

        // Summary totals updates
        document.getElementById('cart-subtotal-val').innerText = `₹${detail.subtotal}`;
        document.getElementById('cart-tax-val').innerText = `₹${detail.tax}`;
        document.getElementById('cart-total-val').innerText = `₹${detail.total}`;

        const discountRow = document.getElementById('cart-discount-row');
        if (detail.discount > 0) {
          document.getElementById('cart-discount-val').innerText = `-₹${detail.discount}`;
          discountRow.style.display = 'flex';
        } else {
          discountRow.style.display = 'none';
        }

        const couponBanner = document.getElementById('applied-coupon-banner');
        if (detail.coupon) {
          document.getElementById('coupon-code-lbl').innerText = detail.coupon.code;
          couponBanner.style.display = 'flex';
        } else {
          couponBanner.style.display = 'none';
        }
      });

      // Tables Map redraw event listener
      window.addEventListener('rms-tables-updated', (e) => {
        // Handle table map updates
      });

      // Inventory triggers event listener
      window.addEventListener('rms-inventory-updated', (e) => {
        const detail = e.detail;
        
        // Redraw low stock KPIs counters
        const lowCount = detail.ingredients.filter(i => i.stock < i.minThreshold).length;
        document.getElementById('low-stock-kpi-val').innerText = `${lowCount} Low Stock`;

        // Render ingredients cards
        const stockBox = document.getElementById('inventory-stock-grid');
        if (stockBox) {
          stockBox.innerHTML = detail.ingredients.map(ing => {
            const pct = Math.min(Math.round((ing.stock / (ing.minThreshold * 2.5)) * 100), 100);
            let stateClass = 'ok';
            if (ing.stock <= 0) stateClass = 'out';
            else if (ing.stock < ing.minThreshold) stateClass = 'low';

            return `
              <div class="stock-card">
                <span class="stock-status-badge ${stateClass}">${stateClass}</span>
                <div class="ingredient-title">${ing.name}</div>
                <div class="ingredient-supplier">Supplier: ${ing.supplier}</div>
                <div class="stock-progress-container">
                  <div class="stock-progress-lbl">
                    <span>Current Stock</span>
                    <span>${ing.stock} ${ing.unit}</span>
                  </div>
                  <div class="stock-progress-bar">
                    <div class="stock-progress-fill ${stateClass}" style="width: ${pct}%"></div>
                  </div>
                </div>
                <div class="stock-actions">
                  <input type="number" step="0.1" placeholder="Qty" id="adjust-qty-${ing.id}">
                  <button onclick="window.RMSApp.handleStockAdjust('${ing.id}')"><i class="fa-solid fa-pen-to-square"></i> Audit</button>
                </div>
              </div>
            `;
          }).join('');
        }

        // Redraw recent waste entries
        const wasteBox = document.getElementById('waste-logs-body');
        const totalWaste = detail.wasteLogs.reduce((sum, l) => sum + l.cost, 0);
        document.getElementById('waste-loss-kpi-val').innerText = `₹${totalWaste}`;
        if (wasteBox) {
          wasteBox.innerHTML = detail.wasteLogs.map(log => `
            <tr>
              <td>${log.date}</td>
              <td><strong>${log.ingredientName}</strong></td>
              <td>${log.quantity} ${log.unit}</td>
              <td style="color:#ef4444; font-weight:700;">₹${log.cost}</td>
              <td><span style="font-size:0.75rem; color:#64748b;">${log.reason}</span></td>
            </tr>
          `).join('');
        }
      });

      // Delivery tracking listener
      window.addEventListener('rms-delivery-updated', (e) => {
        const detail = e.detail;
        
        // Render Delivery Cards
        const container = document.getElementById('delivery-orders-list-box');
        if (container) {
          container.innerHTML = detail.deliveryOrders.map(order => {
            const steps = ['cooking', 'ready', 'out-for-delivery', 'delivered'];
            const labels = ['Cooking', 'KOT Ready', 'Out for Delivery', 'Delivered'];
            
            const curIdx = steps.indexOf(order.status);
            
            let ridersSelect = '';
            if (order.status === 'ready') {
              const avRiders = detail.riders.filter(r => r.status === 'available');
              ridersSelect = `
                <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                  <select class="rms-form-control" style="padding:4px; font-size:0.8rem;" id="rider-sel-${order.id}">
                    ${avRiders.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                  </select>
                  <button class="btn-primary" style="font-size:0.75rem; padding:4px 10px; border-radius:4px;" onclick="window.RMSApp.handleRiderDispatch('${order.id}')">Dispatch Rider</button>
                </div>
              `;
            } else if (order.status === 'out-for-delivery') {
              const assignedRider = detail.riders.find(r => r.id === order.riderId);
              ridersSelect = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; background:#f0fdf4; padding:6px 12px; border-radius:6px; border:1px solid #bbf7d0;">
                  <span style="font-size:0.8rem; font-weight:600; color:#166534;"><i class="fa-solid fa-motorcycle"></i> Courier: ${assignedRider ? assignedRider.name : 'Rider'}</span>
                  <button class="btn-primary" style="background:#10b981; font-size:0.75rem; padding:4px 8px; border-radius:4px;" onclick="window.RMSDelivery.completeDelivery('${order.id}')">Complete</button>
                </div>
              `;
            }

            return `
              <div class="delivery-order-card">
                <div style="display:flex; justify-content:space-between; font-weight:700;">
                  <span style="color:#0f172a;">${order.customer} (ID: ${order.id})</span>
                  <span style="color:#0ea5e9;">ETA: ${order.eta}</span>
                </div>
                <div style="font-size:0.8rem; color:#64748b;">Address: ${order.address}</div>
                
                <div class="delivery-status-timeline">
                  ${steps.map((st, sIdx) => {
                    let activeClass = '';
                    if (sIdx === curIdx) activeClass = 'active';
                    else if (sIdx < curIdx) activeClass = 'completed';

                    return `
                      <div class="timeline-step ${activeClass}">
                        <div class="timeline-dot"></div>
                        <span>${labels[sIdx]}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
                ${ridersSelect}
              </div>
            `;
          }).join('');
        }

        // Render aggregators orders
        const aggBox = document.getElementById('aggregator-feed-box');
        if (aggBox) {
          aggBox.innerHTML = detail.aggregatorFeed.map(feed => {
            let acceptBtn = '';
            if (feed.status === 'pending') {
              acceptBtn = `<button class="btn-primary" style="font-size:0.75rem; border-radius:4px; padding:4px 10px;" onclick="window.RMSDelivery.acceptAggregatorOrder('${feed.id}')">Accept Order</button>`;
            } else {
              acceptBtn = `<span style="font-size:0.8rem; font-weight:700; color:#166534;"><i class="fa-solid fa-circle-check"></i> Dispatched to KOT</span>`;
            }

            return `
              <div class="aggregator-card">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="aggregator-source ${feed.source}">${feed.source}</span>
                    <strong style="font-size:0.85rem; color:#1e293b;">${feed.id}</strong>
                  </div>
                  <div style="font-size:0.8rem; color:#334155; margin-top:5px;">${feed.items}</div>
                  <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">Received: ${feed.time}</div>
                </div>
                <div>
                  ${acceptBtn}
                </div>
              </div>
            `;
          }).join('');
        }
      });

      // CRM updates event listener
      window.addEventListener('rms-crm-updated', (e) => {
        const detail = e.detail;
        
        // Render customer list
        const body = document.getElementById('crm-customer-table-body');
        if (body) {
          body.innerHTML = detail.customers.map(cust => `
            <tr>
              <td><strong>${cust.name}</strong></td>
              <td>${cust.phone}</td>
              <td>${cust.visits} Visits</td>
              <td>${cust.loyaltyPoints} Pts</td>
              <td><span class="tier-badge ${cust.tier}">${cust.tier} Member</span></td>
              <td><span style="font-size:0.8rem; background:#f1f5f9; padding:2px 8px; border-radius:10px;">${cust.favoriteDish}</span></td>
            </tr>
          `).join('');
        }

        // Render targeted promos templates dispatcher
        const promoBox = document.getElementById('campaign-promos-box');
        if (promoBox && window.RMSCRM) {
          promoBox.innerHTML = window.RMSCRM.promotions.map((promo, idx) => `
            <div class="campaign-card">
              <h4>${promo.title}</h4>
              <span class="campaign-tag">Target: ${promo.segment}</span>
              <textarea class="campaign-textarea" readonly>${promo.template}</textarea>
              <button class="btn-primary" style="font-size:0.75rem; border-radius:4px; padding:6px 12px; width:100%;" onclick="window.RMSCRM.sendCampaign(${idx})"><i class="fa-solid fa-paper-plane"></i> Broadcast Message</button>
            </div>
          `).join('');
        }

        // Render feedback reviews comments log
        const reviewsBox = document.getElementById('crm-feedback-logs-box');
        if (reviewsBox) {
          reviewsBox.innerHTML = detail.feedbackLogs.map(feed => `
            <div class="feedback-card-item">
              <div class="feedback-card-meta">
                <span>${feed.customerName}</span>
                <span class="feedback-stars">${'★'.repeat(feed.rating)}${'☆'.repeat(5 - feed.rating)}</span>
              </div>
              <div class="feedback-text">"${feed.comment}"</div>
              <div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-top:5px;">Submitted: ${feed.date}</div>
            </div>
          `).join('');
        }
      });

      // Staff HR Shifts updates
      window.addEventListener('rms-staff-updated', (e) => {
        const detail = e.detail;

        // Render shifts allocation roster lists
        const calendarContainer = document.getElementById('shift-calendar-container');
        if (calendarContainer) {
          calendarContainer.innerHTML = detail.shifts.map(shift => `
            <div class="shift-roster-row">
              <strong>${shift.employee}</strong>
              <span style="color:#64748b;">${shift.day}</span>
              <span style="font-weight:600; color:#0ea5e9;">${shift.time} (${shift.hours} hrs)</span>
            </div>
          `).join('');
        }

        // Render onboarding tutorials cards
        const tutorialBox = document.getElementById('staff-tutorials-box');
        if (tutorialBox) {
          tutorialBox.innerHTML = detail.tutorials.map(tut => {
            let tagClass = 'not-started';
            if (tut.status === 'completed') tagClass = 'completed';
            else if (tut.status === 'in-progress') tagClass = 'in-progress';

            return `
              <div class="tutorial-card">
                <div>
                  <div style="font-weight:700; color:#1e293b; font-size:0.9rem;">${tut.title}</div>
                  <p style="font-size:0.75rem; color:#64748b; margin-top:4px;">${tut.desc}</p>
                </div>
                <div style="text-align:right;">
                  <span class="tutorial-status-tag ${tagClass}">${tut.status.replace('-', ' ')}</span>
                  <div style="font-size:0.7rem; color:#94a3b8; margin-top:5px;"><i class="fa-solid fa-clock"></i> ${tut.duration}</div>
                </div>
              </div>
            `;
          }).join('');
        }
      });

      // Cloud settings branches updates
      window.addEventListener('rms-cloud-updated', (e) => {
        const detail = e.detail;
        
        // Redraw offline sync panels labels
        const alertPanel = document.getElementById('offline-alert-panel');
        const syncBtn = document.getElementById('trigger-sync-btn');
        const counter = document.getElementById('offline-queue-counter');
        const dot = document.querySelector('.sync-dot');
        const indicatorText = document.getElementById('online-sync-lbl');

        if (detail.isOffline) {
          alertPanel.classList.add('active');
          alertPanel.querySelector('div div div').innerText = 'Simulated Connectivity Status: Offline';
          alertPanel.querySelector('button').innerText = 'Reconnect POS System (Go Online)';
          alertPanel.querySelector('button').style.background = '#22c55e';
          dot.classList.add('offline');
          indicatorText.innerHTML = '<span class="sync-dot offline"></span> Offline Mode';
        } else {
          alertPanel.classList.remove('active');
          alertPanel.querySelector('div div div').innerText = 'Simulated Connectivity Status: Online';
          alertPanel.querySelector('button').innerText = 'Simulate Offline Mode';
          alertPanel.querySelector('button').style.background = '#dc2626';
          dot.classList.remove('offline');
          indicatorText.innerHTML = '<span class="sync-dot"></span> Online';
        }

        counter.innerText = `${detail.offlineQueueLength} Bills`;
        if (detail.offlineQueueLength > 0 && !detail.isOffline) {
          syncBtn.removeAttribute('disabled');
        } else {
          syncBtn.setAttribute('disabled', 'true');
        }

        // Render Branch select options
        const branchBox = document.getElementById('cloud-branches-box');
        if (branchBox) {
          branchBox.innerHTML = detail.locations.map(loc => `
            <div class="branch-card ${loc.status === 'primary' ? 'active' : ''}" onclick="window.RMSApp.handleBranchSwitch('${loc.id}')">
              <div style="display:flex; justify-content:space-between; font-weight:700;">
                <span style="color:#0f172a;">${loc.name}</span>
                <span style="font-size:0.7rem; background:#cbd5e1; padding:2px 6px; border-radius:4px; font-weight:600; text-transform:uppercase;">Branch</span>
              </div>
              <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">Address: ${loc.address}</div>
            </div>
          `).join('');
        }
      });

      // Security Console audits updates
      window.addEventListener('rms-audit-updated', (e) => {
        const list = e.detail;
        const box = document.getElementById('security-audit-console-rows');
        if (box) {
          box.innerHTML = list.map(log => `
            <div class="audit-log-row">
              <span class="audit-log-time">[${log.timestamp.split(' ')[1]}]</span>
              <span class="audit-log-module">${log.module}</span>
              <span class="audit-log-action">${log.action}</span>
              <span class="audit-log-user">${log.user}</span>
            </div>
          `).join('');
        }
      });

      // Auto-reorder PO alerts notification listener
      window.addEventListener('rms-reorder-triggered', (e) => {
        const ingredient = e.detail;
        alert(`INVENTORY WARNING: Stock level of ${ingredient.name} is dangerously low (${ingredient.stock} ${ingredient.unit}). Reorder purchase order generated to supplier: ${ingredient.supplier}.`);
      });
    },

    // Stock Adjust Actions trigger
    handleStockAdjust: function(ingId) {
      const input = document.getElementById(`adjust-qty-${ingId}`);
      if (input && input.value && window.RMSInventory) {
        window.RMSInventory.adjustStock(ingId, input.value);
        input.value = '';
      }
    },

    // Waste Logging Action submission
    handleWasteSubmission: function(e) {
      e.preventDefault();
      const select = document.getElementById('waste-select-ing').value;
      const qty = parseFloat(document.getElementById('waste-qty').value);
      const reason = document.getElementById('waste-reason').value;

      if (window.RMSInventory && select && qty > 0 && reason) {
        window.RMSInventory.logWaste(select, qty, reason);
        document.getElementById('waste-log-form').reset();
      }
    },

    // Dispatch delivery rider
    handleRiderDispatch: function(orderId) {
      const select = document.getElementById(`rider-sel-${orderId}`);
      if (select && window.RMSDelivery) {
        window.RMSDelivery.assignRider(orderId, select.value);
      }
    },

    // Lookup customer from loyalty database
    handleCRMSearch: function() {
      const val = document.getElementById('crm-search-phone').value;
      if (!val) return;

      if (window.RMSCRM) {
        const cust = window.RMSCRM.lookupCustomer(val);
        if (cust) {
          alert(`Customer profile found:\nName: ${cust.name}\nVisits: ${cust.visits}\nPoints: ${cust.loyaltyPoints}\nTier: ${cust.tier}\nFavorite dish: ${cust.favoriteDish}`);
        } else {
          alert('No customer matched this phone number in registry.');
        }
      }
    },

    // Schedule staff shift
    handleShiftScheduling: function(e) {
      e.preventDefault();
      const staffName = document.getElementById('shift-select-staff').value;
      const day = document.getElementById('shift-day').value;
      const time = document.getElementById('shift-time').value;
      const hours = document.getElementById('shift-hours').value;

      if (window.RMSStaff && staffName && day && time) {
        window.RMSStaff.scheduleShift(staffName, day, time, hours);
        document.getElementById('shift-planner-form').reset();
      }
    },

    // Coupon configurations adding
    handleCouponCreation: function(e) {
      e.preventDefault();
      const code = document.getElementById('coupon-code').value;
      const type = document.getElementById('coupon-type').value;
      const value = document.getElementById('coupon-value').value;
      const minBill = document.getElementById('coupon-min-bill').value;

      if (window.RMSMarketing) {
        const success = window.RMSMarketing.createPromoCoupon(code, type, value, minBill);
        if (success) {
          alert(`Promotion coupon code ${code.toUpperCase()} has been generated and activated successfully.`);
          document.getElementById('coupon-creator-form').reset();
        }
      }
    },

    // Sync cloud buffers
    toggleNetworkConnection: function() {
      if (window.RMSCloud) {
        const isOff = window.RMSCloud.setOfflineMode(!window.RMSCloud.isOffline);
      }
    },

    triggerCloudSync: function() {
      if (!window.RMSCloud) return;

      const progressBox = document.getElementById('sync-progress-bar-box');
      const progressFill = document.getElementById('sync-progress-fill-bar');
      const progressLbl = document.getElementById('sync-progress-lbl');
      const syncBtn = document.getElementById('trigger-sync-btn');

      syncBtn.setAttribute('disabled', 'true');
      progressBox.style.display = 'block';

      window.RMSCloud.syncOfflineBills(
        (percent) => {
          progressFill.style.width = `${percent}%`;
          progressLbl.innerText = `${percent}%`;
        },
        (syncedCount) => {
          alert(`Database sync finished. Successfully updated ${syncedCount} bills to master cloud database schema.`);
          progressBox.style.display = 'none';
          progressFill.style.width = '0%';
          progressLbl.innerText = '0%';
        }
      );
    },

    handleBranchSwitch: function(locId) {
      if (window.RMSCloud) {
        const loc = window.RMSCloud.switchLocation(locId);
        if (loc) {
          // Update location active class in array
          window.RMSCloud.locations.forEach(l => {
            l.status = l.id === locId ? 'primary' : 'active';
          });
          window.RMSCloud.updateCloudUI();
          alert(`Switched active restaurant outlet terminal to: ${loc.name}. Menu lists and dashboard stats successfully synced.`);
        }
      }
    },

    // Digital Menu tabletop QR Code simulation
    openQRMenuSimulator: function() {
      if (window.RMSBilling) {
        const mockBox = document.getElementById('qr-mock-menu-list');
        mockBox.innerHTML = window.RMSBilling.menuItems.slice(0, 3).map(item => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:8px;">
            <div>
              <span style="font-size:1.3rem;">${item.image}</span>
              <strong style="font-size:0.8rem; color:#1e293b; display:block; margin-top:2px;">${item.name}</strong>
              <span style="font-size:0.75rem; color:#0ea5e9; font-weight:700;">₹${item.price}</span>
            </div>
            <input type="checkbox" name="qr-order-items" value="${item.id}" style="width:18px; height:18px; accent-color:#f97316;">
          </div>
        `).join('');

        document.getElementById('qr-menu-simulator-modal').style.display = 'flex';
      }
    },

    closeQRMenuSimulator: function() {
      document.getElementById('qr-menu-simulator-modal').style.display = 'none';
    },

    submitQROrderDirectly: function() {
      const checks = document.querySelectorAll('input[name="qr-order-items"]:checked');
      if (checks.length === 0) {
        alert('Please select at least one menu item.');
        return;
      }

      if (!window.RMSBilling) return;

      const itemsSelected = Array.from(checks).map(c => {
        const item = window.RMSBilling.menuItems.find(mi => mi.id === c.value);
        return {
          name: item.name + ' (Regular)',
          qty: 1
        };
      });

      // Submit KOT
      const newKOT = {
        id: 'kot-' + Date.now().toString().substr(-4),
        table: 'Table 4 (QR Order)',
        time: 'Just now',
        items: itemsSelected,
        status: 'pending'
      };

      this.kotQueue.unshift(newKOT);
      this.renderKDS();

      if (window.RMSSecurity) {
        window.RMSSecurity.addAuditLog('QR Ordering', `Customer submitted direct tabletop KOT via QR scan from Table 4.`);
      }

      alert('Order successfully submitted direct to kitchen display! KOT generated.');
      this.closeQRMenuSimulator();
    },

    // Dropdowns setups helper
    setupInventoryFormDropdowns: function() {
      const select = document.getElementById('waste-select-ing');
      if (select && window.RMSInventory) {
        select.innerHTML = window.RMSInventory.ingredients.map(i => `
          <option value="${i.id}">${i.name} (Unit: ${i.unit})</option>
        `).join('');
      }
    },

    setupShiftPlannerDropdowns: function() {
      const select = document.getElementById('shift-select-staff');
      if (select && window.RMSStaff) {
        select.innerHTML = window.RMSStaff.employees.map(e => `
          <option value="${e.name}">${e.name} (${e.role.toUpperCase()})</option>
        `).join('');
      }
    }
  };

  window.RMSApp = AppOrchestrator;

  // Launch on window load
  window.addEventListener('DOMContentLoaded', () => {
    window.RMSApp.init();
  });
})();
