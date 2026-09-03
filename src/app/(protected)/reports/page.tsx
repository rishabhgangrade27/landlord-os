import { prisma } from '@/lib/db'

// See dashboard/page.tsx — plain Prisma reads don't force dynamic rendering
// on their own, so this would otherwise get statically frozen at build time.
export const dynamic = 'force-dynamic'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddExpenseForm } from './add-expense-form'

export default async function ReportsPage() {


  const [
    properties,
    recentExpenses,
    yearlyPayments,
    monthlyProfit,
    propertyProfit,
  ] = await Promise.all([
    prisma.property.findMany({
      select: { id: true, name: true, address: true, nickname: true },
      orderBy: { name: 'asc' }
    }),
    prisma.expense.findMany({
      select: { id: true, category: true, description: true, amount: true, expense_date: true, property_id: true },
      orderBy: { expense_date: 'desc' },
      take: 20
    }),
    prisma.$queryRaw<any[]>`SELECT * FROM view_yearly_payments`,
    prisma.$queryRaw<any[]>`SELECT * FROM monthly_profit`,
    prisma.$queryRaw<any[]>`SELECT * FROM property_profit`,
  ])

  // Unit table has 0 real rows (see SCRATCHPAD.md) — Property serves as
  // the unit everywhere else in this app, expense entry works the same way.
  const units: any[] = []

  return (
    <div>
      <PageHeader title="Reports" description="Financial summaries and analytics" />

      <div className="p-4 md:p-6">
        <Tabs defaultValue="yearly">
          <div className="overflow-x-auto mb-6">
            <TabsList className="w-max min-w-full sm:w-auto">
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
              <TabsTrigger value="profit">Monthly Profit</TabsTrigger>
              <TabsTrigger value="property">By Property</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
            </TabsList>
          </div>

          {/* Yearly Payments */}
          <TabsContent value="yearly">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yearly Payment Summary — Per Tenant</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!yearlyPayments?.length ? (
                  <p className="p-4 text-sm text-muted-foreground">No payment data available yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tenant</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Year</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Due</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Paid</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlyPayments.map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium">
                              {(row as any).tenant_name ?? (row as any).full_legal_name ?? row.tenant_id?.slice(0, 8)}
                              <span className="text-xs text-muted-foreground sm:hidden ml-1">({row.year})</span>
                            </td>
                            <td className="px-4 py-2 hidden sm:table-cell">{row.year}</td>
                            <td className="px-4 py-2 text-right hidden md:table-cell">${Number(row.total_due).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700 hidden md:table-cell">${Number(row.total_paid).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right font-semibold ${Number(row.total_balance) > 0 ? 'text-destructive' : 'text-green-700'}`}>
                              ${Number(row.total_balance).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Profit */}
          <TabsContent value="profit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!monthlyProfit?.length ? (
                  <p className="p-4 text-sm text-muted-foreground">No data available yet. Ensure transactions are verified and expenses are logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Month</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Income</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Expenses</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyProfit.map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2">
                              {row.month ? new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-4 py-2 text-right text-green-700 hidden sm:table-cell">${Number(row.income).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-destructive hidden sm:table-cell">${Number(row.expenses).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right font-semibold ${Number(row.profit) >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                              ${Number(row.profit).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Property Profit */}
          <TabsContent value="property">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profit by Property</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!propertyProfit?.length ? (
                  <p className="p-4 text-sm text-muted-foreground">No property data available yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Property</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Income</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Expenses</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propertyProfit.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium">{row.property_name ?? row.address ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-green-700 hidden sm:table-cell">${Number(row.income).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-destructive hidden sm:table-cell">${Number(row.expenses).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right font-semibold ${Number(row.profit) >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                              ${Number(row.profit).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Log Expense */}
          <TabsContent value="expenses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Expense</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddExpenseForm
                    properties={(properties ?? []) as any}
                    units={(units ?? []) as any}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!recentExpenses?.length ? (
                    <p className="p-4 text-sm text-muted-foreground">No expenses logged yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Category</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentExpenses.map((e) => (
                          <tr key={e.id} className="border-b last:border-0">
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {e.expense_date ? new Date(e.expense_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-2 capitalize">{e.category}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {e.description ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-destructive">
                              ${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
