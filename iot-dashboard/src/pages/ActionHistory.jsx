import { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import apiService from '../services/api';
import './ActionHistory.css';

const ActionHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  const itemsPerPage = 7;

  // Fetch data from backend
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await apiService.getActions(100); // Get last 100 actions
      
      // ✅ Hỗ trợ cả format mới (object) và cũ (array)
      const actions = result?.data || (Array.isArray(result) ? result : []);
      
      if (actions.length > 0) {
        const formatted = actions.map((item, index) => ({
          id: item.id || index + 1,
          device: item.target.toUpperCase(),
          action: item.action,
          time: new Date(item.timestamp).toLocaleString('vi-VN'),
          issued_by: item.issued_by || 'system'
        }));
        setHistoryData(formatted);
      }
      setLoading(false);
    };

    fetchData();
    
    // Auto refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Pagination
  const totalPages = Math.ceil(historyData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = historyData.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="action-history">
      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Search (ID,Devices or Time)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option>All</option>
          <option>FAN</option>
          <option>AC</option>
          <option>LED</option>
        </select>
        <button className="search-btn">
          Search
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#00b4d8' }}>
            Loading...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Devices</th>
                <th>Action</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                    <td>{row.id}</td>
                    <td>{row.device}</td>
                    <td>{row.action}</td>
                    <td>{row.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                    No action history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button 
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <FaChevronLeft />
        </button>

        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`page-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        ))}

        <button 
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          <FaChevronRight />
        </button>

        <span className="items-per-page">{itemsPerPage}/page</span>
      </div>
    </div>
  );
};

export default ActionHistory;