export default function AdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-dark mb-4">Admin Portal</h1>
        <p className="text-brand-dark/60 mb-8">Choose an option:</p>
        <div className="space-y-4">
          <a href="/admin/login" className="block px-8 py-3 bg-brand-dark text-white rounded-md">
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
