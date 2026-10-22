export type Book = {
  id: number;
  title: string;
  author: string;
  isbn: string;
  totalCopies: number;
  availableCopies: number;
};

export type Loan = {
  id: number;
  bookId: number;
  memberId: number;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  lateFee: number;
};

export type OverdueLoan = {
  id: number;
  memberName: string;
  memberWhatsapp: string | null;
  bookTitle: string;
  dueAt: string;
  lateFee: number;
};
