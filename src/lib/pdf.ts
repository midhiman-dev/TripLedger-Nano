import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { Trip, Expense, CATEGORIES } from '../types';

export const generateTripReport = (trip: Trip, expenses: Expense[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Forecasting Logic
  const startDate = trip.trip_start_date?.toDate() || new Date();
  const endDate = trip.trip_end_date?.toDate() || new Date();
  const now = startOfDay(new Date());
  const totalTripDuration = Math.max(1, differenceInDays(startOfDay(endDate), startOfDay(startDate)) + 1);
  const daysElapsed = Math.min(totalTripDuration, Math.max(1, differenceInDays(now, startOfDay(startDate)) + 1));

  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 75, 113); // Primary color
  doc.text('Trip Ledger & Forecast Report', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 28);
  doc.text(`Trip Duration: ${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')} (${totalTripDuration} days)`, 14, 33);
  doc.text(`Day ${daysElapsed} of ${totalTripDuration}`, 14, 38);

  // Trip Info
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(trip.trip_name, 14, 50);

  // Budget Summary Table with Forecast
  const totalBudget = Object.values(trip.budget).reduce((a, b: any) => a + b, 0);
  const totalSpent = expenses.reduce((a, b) => a + b.amount_inr, 0);
  
  autoTable(doc, {
    startY: 55,
    head: [['Category', 'Budget', 'Daily Avg', 'Projected', 'Risk Status']],
    body: CATEGORIES.map(cat => {
      const budget = trip.budget[cat.value] || 0;
      const spent = expenses
        .filter(e => e.category === cat.value)
        .reduce((a, b) => a + b.amount_inr, 0);
      
      const dailyAvg = cat.value === 'accommodation' 
        ? spent / totalTripDuration 
        : spent / daysElapsed;
      
      const forecasted = cat.value === 'accommodation' 
        ? spent 
        : Math.round(dailyAvg * totalTripDuration);
      
      let status = 'On Track';
      if (forecasted > budget * 1.15) status = 'HIGH RISK';
      else if (forecasted > budget) status = 'AT RISK';
      
      return [
        cat.label,
        `INR ${budget.toLocaleString()}`,
        `INR ${Math.round(dailyAvg).toLocaleString()}`,
        `INR ${forecasted.toLocaleString()}`,
        status
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: [0, 75, 113] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const text = data.cell.text[0];
        if (text === 'HIGH RISK') {
          data.cell.styles.textColor = [186, 26, 26]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'AT RISK') {
          data.cell.styles.textColor = [245, 158, 11]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [0, 110, 28]; // Green
        }
      }
    }
  });

  // Detailed Expenses
  const lastY = (doc as any).lastAutoTable.finalY || 60;
  doc.setFontSize(14);
  doc.text('Detailed Expenses', 14, lastY + 15);

  const expenseData = expenses
    .sort((a, b) => b.date.seconds - a.date.seconds)
    .map(e => [
      format(e.date.toDate(), 'MMM dd, yyyy'),
      CATEGORIES.find(c => c.value === e.category)?.label || e.category,
      e.payment_source || '-',
      `INR ${e.amount_inr.toLocaleString()}`,
      e.notes || '-'
    ]);

  autoTable(doc, {
    startY: lastY + 20,
    head: [['Date', 'Category', 'Source', 'Amount', 'Notes']],
    body: expenseData,
    theme: 'grid',
    headStyles: { fillColor: [0, 110, 28] } // Secondary color
  });

  // Spending by Source Summary
  const nextY = (doc as any).lastAutoTable.finalY || lastY + 40;
  doc.setFontSize(14);
  doc.setTextColor(0, 75, 113);
  doc.text('Spending by Source', 14, nextY + 15);

  const sourcesMap: { [key: string]: number } = {};
  expenses.forEach(e => {
    const s = e.payment_source || 'Unknown';
    sourcesMap[s] = (sourcesMap[s] || 0) + e.amount_inr;
  });

  const sourcesData = Object.entries(sourcesMap).map(([source, amount]) => [
    source,
    `INR ${amount.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: nextY + 20,
    head: [['Source', 'Total Spent']],
    body: sourcesData,
    theme: 'plain',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  // Final Summary
  const finalY = (doc as any).lastAutoTable.finalY || nextY + 40;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total Budget: INR ${totalBudget.toLocaleString()}`, 14, finalY + 15);
  doc.text(`Total Spent: INR ${totalSpent.toLocaleString()}`, 14, finalY + 22);
  
  doc.setFontSize(14);
  const remaining = totalBudget - totalSpent;
  if (remaining >= 0) {
    doc.setTextColor(0, 110, 28);
  } else {
    doc.setTextColor(186, 26, 26);
  }
  doc.text(`Remaining Balance: INR ${remaining.toLocaleString()}`, 14, finalY + 32);

  doc.save(`${trip.trip_name.replace(/\s+/g, '_')}_Report.pdf`);
};
