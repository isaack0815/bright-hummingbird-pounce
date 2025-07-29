import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FreightOrder } from "@/types/freight";

type OrderTableProps = {
  orders: FreightOrder[];
  onDelete: (id: number) => void;
};

export const OrderTable = ({ orders, onDelete }: OrderTableProps) => {
  const navigate = useNavigate();

  if (orders.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Keine Aufträge in dieser Ansicht gefunden.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Auftragsnr.</TableHead>
          <TableHead>Kunde</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Von</TableHead>
          <TableHead>Nach</TableHead>
          <TableHead>Abholdatum</TableHead>
          <TableHead>
            <span className="sr-only">Aktionen</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.order_number}</TableCell>
            <TableCell>{order.customers?.company_name || 'N/A'}</TableCell>
            <TableCell><Badge>{order.status}</Badge></TableCell>
            <TableCell>{order.origin_address}</TableCell>
            <TableCell>{order.destination_address}</TableCell>
            <TableCell>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : '-'}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate(`/freight-orders/edit/${order.id}`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(order.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};